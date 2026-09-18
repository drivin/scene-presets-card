import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = fileURLToPath(new URL('../', import.meta.url));
const {version} = JSON.parse(await readFile(root + 'package.json', 'utf8'));
const bundle = await readFile(root + 'scene-presets-card.js');
let oldSourceRequests = 0;
let unexpectedSourceRequests = 0;
let sourceVersion = 'cached-old';
const server = createServer((req,res) => {
  const url = new URL(req.url, 'http://localhost');
  const path = url.pathname;
  res.setHeader('Cache-Control', 'no-store');
  if (['/old','/changed-entry','/fixed'].includes(path)) {
    res.setHeader('Content-Type', 'text/html');
    const query = path === '/old' ? '1.1.0' : path === '/changed-entry' ? '1.1.1' : version;
    res.end('<html><body><script type="module" src="/scene-presets-card.js?v=' + query + '"></script></body></html>');
  } else if (path === '/scene-presets-card.js') {
    res.setHeader('Content-Type', 'text/javascript');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    if (url.searchParams.get('v') === version) res.end(bundle);
    else res.end('import {VERSION} from "/src/legacy.js"; customElements.define("scene-presets-card", class extends HTMLElement { static get version() { return VERSION; } });');
  } else if (path === '/src/legacy.js') {
    oldSourceRequests++;
    res.setHeader('Content-Type', 'text/javascript');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.end('export const VERSION = ' + JSON.stringify(sourceVersion) + ';');
  } else if (path.startsWith('/src/')) {
    unexpectedSourceRequests++;
    res.writeHead(500);res.end('Runtime module import is forbidden in the release.');
  } else if (path === '/assets/scene_presets/scene_presets.json') {
    res.setHeader('Content-Type','application/json');
    res.end(JSON.stringify({categories:[{id:'a',name:'Relax'},{id:'b',name:'Party'}],presets:[{id:'x',name:'Sunset',categoryId:'a'},{id:'y',name:'Disco',categoryId:'b'}]}));
  } else {res.writeHead(404);res.end();}
});
await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
let browser;
try {
  browser = await chromium.launch({headless:true,args:['--no-sandbox']});
  // No request routing: Playwright routing disables the HTTP cache.
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const loadedVersion = async () => {
    await page.waitForFunction(() => customElements.get('scene-presets-card'));
    return page.evaluate(() => customElements.get('scene-presets-card').version);
  };
  await page.goto(origin + '/old');
  assert.equal(await loadedVersion(),'cached-old');
  sourceVersion = 'server-new';
  await page.goto(origin + '/changed-entry');
  assert.equal(await loadedVersion(),'cached-old','Changing only the entry query keeps stale imported modules');
  assert.equal(oldSourceRequests,1,'Second page used the cached child module');
  await page.goto(origin + '/fixed');
  assert.equal(await loadedVersion(),version);
  assert.equal(unexpectedSourceRequests,0,'Release must not request any source module');
  await page.evaluate(() => {
    const hass = {locale:{language:'de'},user:{id:'test'},services:{scene_presets:{apply_preset:{},start_dynamic_scene:{}}},states:{}};
    const config = {type:'custom:scene-presets-card',targets:{entity_id:['light.test']},
      filter:{mode:'include',presets:['x']},display:{category_selector:true}};
    const card=document.createElement('scene-presets-card');
    card.setConfig(config);card.hass=hass;document.body.append(card);
    customElements.define('ha-selector', class extends HTMLElement {});
    const editor=document.createElement('scene-presets-editor');
    editor.setConfig(config);editor.hass=hass;document.body.append(editor);
  });
  const card=page.locator('scene-presets-card');
  await card.locator('.tile').first().waitFor();
  assert.equal(await card.locator('.tile').count(),1);
  assert.deepEqual(await card.getByLabel('Kategorie',{exact:true}).locator('option').evaluateAll(nodes=>nodes.map(n=>n.value)),['','a']);
  const editor=page.locator('scene-presets-editor');
  await editor.getByText('1 · Lampen',{exact:true}).waitFor();
  assert.equal(await editor.locator('.version').innerText(),'Scene Presets Card · ' + version);
  assert.deepEqual(errors,[]);
  console.log('Warm-cache regression passed: reproduced stale child modules; versioned bundle loads new editor and filtered categories without source requests.');
} finally {
  await browser?.close();
  await new Promise(resolve=>server.close(resolve));
}
