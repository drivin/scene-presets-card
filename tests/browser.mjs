// Run with PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tests/browser.mjs
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root=fileURLToPath(new URL('../',import.meta.url));
const previewData=JSON.parse(await readFile(root+'tests/fixtures/scene-presets.json','utf8'));
const server=createServer(async(req,res)=>{
  const path=new URL(req.url,'http://localhost').pathname;
  if(path==='/') {res.setHeader('Content-Type','text/html');res.end(`<html><head><style>
    :root{color-scheme:dark;--primary-text-color:#e1e1e1;--secondary-text-color:#a8adb5;--primary-color:#03a9f4;--divider-color:#3b4149;--card-background-color:#1c1c1c;--secondary-background-color:#252a31}
    html,body{margin:0;background:#11151a;color:var(--primary-text-color);font-family:system-ui}body{padding:24px}scene-presets-card,scene-presets-editor{display:block;background:var(--card-background-color);border-radius:16px;box-shadow:0 8px 30px #0008}#preview{width:980px;padding:20px}
  </style></head><body><script type="module" src="/scene-presets-card.js"></script></body></html>`);return;}
  try {
    const file=path.startsWith('/assets/scene_presets/')
      ? root+'tests/fixtures/scene-presets/'+path.slice('/assets/scene_presets/'.length)
      : root+path.slice(1);
    const data=await readFile(file);
    res.setHeader('Content-Type',path.endsWith('.js')?'text/javascript':path.endsWith('.jpeg')?'image/jpeg':'text/plain');res.end(data);
  }
  catch {res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try {
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1050,height:900}});
  page.setDefaultTimeout(10000);
  const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error(e.stack);});
  let requests=0; let endpointStatus=200;
  await page.route('**/assets/scene_presets/scene_presets.json',route=>{requests++;if(endpointStatus!==200)return route.fulfill({status:endpointStatus,body:'Unavailable'});return route.fulfill({json:{categories:[{id:'a',name:'Relax'},{id:'b',name:'Party'}],presets:[{id:'x',name:'Sunset',categoryId:'a'},{id:'y',name:'Custom',categoryId:'b',custom:true}]}});});
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.evaluate(async()=>{
    await customElements.whenDefined('scene-presets-card');
    window.calls=[];window.stored=new Map();window.subscribers=new Map();
    window.hassMock={locale:{language:'de'},user:{id:'one',is_admin:true},states:{'light.one':{state:'on',attributes:{friendly_name:'Ceiling'}}},
      services:{scene_presets:{apply_preset:{},start_dynamic_scene:{},stop_dynamic_scene:{}}},
      callService:async(...args)=>window.calls.push(args),
      callWS:async msg=>{
        if(msg.type==='scene_presets/get_dynamic_scenes')return {dynamic_scenes:[{id:'dyn',running:true,interval:120,parameters:{preset_id:'x',light_entity_ids:['light.one'],transition:60}}]};
        if(msg.type.includes('/set_')){stored.set(msg.key,msg.value);subscribers.get(msg.key)?.forEach(cb=>cb({value:msg.value}));return;}
        return {value:stored.get(msg.key)??null};
      },connection:{subscribeMessage:async(cb,msg)=>{const set=subscribers.get(msg.key)||new Set();set.add(cb);subscribers.set(msg.key,set);cb({value:stored.get(msg.key)??null});return()=>set.delete(cb);}}};
    window.config={type:'custom:scene-presets-card',targets:{entity_id:['light.one']},favorites:{enabled:true},display:{search:true,category_selector:true,active_scene:true},controls:{mode:true,brightness:true,transition:true,interval:true}};
    for(let i=0;i<2;i++){const card=document.createElement('scene-presets-card');card.setConfig(config);card.hass=hassMock;document.body.append(card);}
  });
  const card=page.locator('scene-presets-card').first();
  await card.locator('.tile').first().waitFor();
  await page.waitForFunction(()=>document.querySelectorAll('scene-presets-card')[1].shadowRoot.querySelectorAll('.tile').length===2);
  assert.equal(requests,1,'shared discovery request');
  assert.equal(await card.locator('.tile').count(),2);
  assert.equal(await card.locator('.name').first().evaluate(node=>getComputedStyle(node).textAlign),'left');
  assert.equal(await card.locator('.preset-group').count(),0);
  assert.equal(await card.locator('.toolbar h2').count(),1);
  await page.evaluate(()=>document.querySelector('scene-presets-card').setConfig({...config,display:{...config.display,show_title:false}}));
  assert.equal(await card.locator('.toolbar h2').count(),0);
  assert.equal(await card.getByRole('button',{name:'Presets und Status aktualisieren'}).count(),1);
  await page.evaluate(()=>document.querySelector('scene-presets-card').setConfig(config));
  const brightnessNumber=card.getByRole('spinbutton',{name:'Helligkeit (1–255)',exact:true});
  assert.equal(await brightnessNumber.isDisabled(),true);
  assert.equal(await card.getByRole('slider').count(),0);
  await page.evaluate(()=>document.querySelector('scene-presets-card').setConfig({...config,controls:{...config.controls,brightness_input:'slider'}}));
  const brightnessSlider=card.getByRole('slider',{name:'Schieberegler für Helligkeit (1–255)',exact:true});
  assert.equal(await brightnessSlider.isDisabled(),true);
  assert.equal(await card.getByRole('spinbutton',{name:'Helligkeit (1–255)',exact:true}).count(),0);
  await page.evaluate(()=>document.querySelector('scene-presets-card').setConfig(config));
  await card.getByRole('button',{name:'Sunset anwenden',exact:true}).click();
  assert.equal(await page.evaluate(()=>calls[0][1]),'apply_preset');
  await card.getByRole('button',{name:'Sunset: Favorit umschalten'}).click();
  await page.waitForFunction(()=>document.querySelectorAll('scene-presets-card')[1].shadowRoot.querySelector('.favorite')?.textContent==='★');
  assert.equal(await page.evaluate(()=>calls.length),1,'favorite must not apply');
  assert.equal(await card.locator('.info').count(),0,'service-preview icons removed');
  assert.equal(await card.locator('dialog').count(),0,'no service-preview dialog');
  assert.equal(await card.locator('.tile button').count(),4,'tiles contain only apply and favorite actions');
  await card.getByRole('searchbox',{name:'Presets suchen'}).fill('Party');
  await page.waitForFunction(()=>document.querySelector('scene-presets-card').shadowRoot.querySelectorAll('.tile').length===1);
  assert.match(await card.locator('.tile').innerText(),/Custom/);
  await card.getByRole('searchbox',{name:'Presets suchen'}).fill('');
  await page.waitForFunction(()=>document.querySelector('scene-presets-card').shadowRoot.querySelectorAll('.tile').length===2);
  await card.getByLabel('Modus',{exact:true}).selectOption('dynamic');
  await card.getByRole('button',{name:'Sunset anwenden',exact:true}).click();
  assert.equal(await page.evaluate(()=>calls.at(-1)[1]),'start_dynamic_scene');
  assert.equal(await card.locator('.tile.active').count(),1);
  await card.getByText('Sunset',{exact:true}).last().click();
  await card.getByRole('button',{name:'Stop',exact:true}).click();
  assert.equal(await page.evaluate(()=>calls.at(-1)[1]),'stop_dynamic_scene');

  // Navigation is based on config-eligible children, and resets a removed category.
  await page.evaluate(()=>document.querySelector('scene-presets-card').setConfig({...config,filter:{mode:'include',presets:['x']}}));
  await page.waitForFunction(()=>document.querySelector('scene-presets-card').data);
  assert.deepEqual(await card.getByLabel('Kategorie',{exact:true}).locator('option').evaluateAll(nodes=>nodes.map(n=>n.value)),['','a']);
  await card.getByLabel('Kategorie',{exact:true}).selectOption('a');
  await page.evaluate(()=>{
    const card=document.querySelector('scene-presets-card');
    card.data={...card.data,presets:card.data.presets.filter(p=>p.id!=='x')};card.render();
  });
  assert.equal(await card.getByLabel('Kategorie',{exact:true}).inputValue(),'');
  assert.equal(await card.locator('.tile').count(),0);

  // Failure of optional renderer must retain functional internal tiles.
  await page.evaluate(()=>document.querySelector('scene-presets-card').setConfig({...config,preset_card:{type:'custom:missing-card'}}));
  await card.getByText(/Interner Renderer wird verwendet/).waitFor();
  assert.equal(await card.locator('.tile').count(),2);
  // Runtime persistence uses a stable key and survives remount.
  await page.evaluate(()=>document.querySelector('scene-presets-card').setConfig({...config,remember:{controls:true},storage_key:'room'}));
  await card.getByLabel('Modus',{exact:true}).selectOption('dynamic');
  await page.waitForFunction(()=>stored.get('scene_presets_card:runtime:room')?.scene.mode==='dynamic');
  await page.evaluate(()=>document.querySelector('scene-presets-card').setConfig({...config,remember:{controls:true},storage_key:'room'}));
  await page.waitForFunction(()=>document.querySelector('scene-presets-card').scene.mode==='dynamic');
  // Editor events retain unknown root and child properties.
  await page.evaluate(()=>{
    customElements.define('ha-selector',class extends HTMLElement{});
    const editor=document.createElement('scene-presets-editor');window.edited=null;
    editor.addEventListener('config-changed',e=>window.edited=e.detail.config);
    editor.setConfig({...config,unknown:{keep:42},preset_card:{type:'custom:button-card',custom_property_xyz:7},filter:{presets:['gone']}});
    editor.hass=hassMock;document.body.append(editor);
  });
  const editor=page.locator('scene-presets-editor');
  await editor.getByText('Fehlendes Preset: gone',{exact:true}).waitFor();
  await editor.locator('details[data-section="display"] > summary').click();
  await editor.getByLabel('Titel',{exact:true}).fill('Edited');
  await editor.getByLabel('Titel',{exact:true}).press('Tab');
  assert.deepEqual(await page.evaluate(()=>[edited.unknown.keep,edited.preset_card.custom_property_xyz,edited.title]),[42,7,'Edited']);
  assert.equal(await editor.locator('ha-selector').count(),1);
  await editor.getByRole('checkbox',{name:'Titel anzeigen',exact:true}).uncheck();
  assert.equal(await page.evaluate(()=>edited.display.show_title),false);
  await editor.locator('details[data-section="controls"] > summary').click();
  await editor.getByLabel('Helligkeitseingabe',{exact:true}).selectOption('slider');
  assert.equal(await page.evaluate(()=>edited.controls.brightness_input),'slider');
  await editor.locator('details[data-section="scene"] > summary').click();
  assert.equal(await editor.getByRole('slider',{name:'Schieberegler für Helligkeit (1–255)',exact:true}).count(),1);

  // A selection edit preserves the expanded section and the user's search.
  assert.equal(await editor.locator('details[data-section="targets"]').getAttribute('open'),'');
  assert.equal(await editor.locator('details[data-section="renderer"]').getAttribute('open'),null);
  await editor.locator('details[data-section="filter"] > summary').click();
  await editor.locator('details[data-section="presets"] > summary').click();
  await editor.getByRole('searchbox',{name:'Presetauswahl durchsuchen'}).fill('Sun');
  await editor.getByRole('checkbox',{name:'Sunset',exact:true}).check();
  assert.equal(await editor.getByRole('searchbox',{name:'Presetauswahl durchsuchen'}).inputValue(),'Sun');
  assert.equal(await editor.getByRole('checkbox',{name:'Sunset',exact:true}).isChecked(),true);
  assert.equal(await page.evaluate(()=>edited.preset_card.custom_property_xyz),7);

  // Simulate available child card contract without depending on an external CDN.
  await page.evaluate(()=>{
    customElements.define('button-card',class extends HTMLElement{});
    window.loadCardHelpers=async()=>({createCardElement:config=>{const child=document.createElement('button-card');child.config=config;child.textContent=config.name;return child;}});
    document.querySelector('scene-presets-card').setConfig({...config,preset_card:{type:'custom:button-card',template:'demo'}});
  });
  await card.locator('button-card').first().waitFor();
  assert.equal(await card.locator('button-card').first().evaluate(el=>el.config.variables.preset.id),'x');
  assert.equal(await card.locator('button-card').first().evaluate(el=>el.inert),true);

  // Both card and editor show the actionable activation hint and recover on retry.
  endpointStatus=404;
  await card.getByRole('button',{name:'Presets und Status aktualisieren'}).click();
  await card.getByText(/Integration hinzufügen/).waitFor();
  await editor.evaluate(e=>e.load(true));
  await editor.getByRole('alert').getByText(/Integration hinzufügen/).waitFor();
  // Existing error notices translate on profile changes, independently per instance.
  const requestsBeforeLanguageSwitch = requests;
  const callsBeforeLanguageSwitch = await page.evaluate(()=>calls.length);
  for (const [language, refresh, hint, heading, title] of [
    ['en-US','Refresh presets and status','Add integration','1 · Lights','Title'],
    ['nl-BE','Presets en status vernieuwen','Integratie toevoegen','1 · Lampen','Titel'],
    ['fr-CA','Actualiser les préréglages et leur état','Ajouter une intégration','1 · Lumières','Titre'],
    ['es','Refresh presets and status','Add integration','1 · Lights','Title'],
    ['de-DE','Presets und Status aktualisieren','Integration hinzufügen','1 · Lampen','Titel'],
  ]) {
    await page.evaluate(language=>{
      const hass={...hassMock,locale:{language}};
      document.querySelector('scene-presets-card').hass=hass;
      document.querySelector('scene-presets-editor').hass=hass;
    },language);
    await card.getByRole('button',{name:refresh,exact:true}).waitFor();
    assert.ok((await card.locator('#notices').innerText()).includes(hint));
    assert.ok((await editor.getByRole('alert').innerText()).includes(hint));
    assert.equal(await editor.locator('details[data-section="targets"] > summary').innerText(),heading);
    assert.equal(await editor.getByLabel(title,{exact:true}).inputValue(),'Edited');
    assert.equal(await editor.locator('details[data-section="presets"] input[type="search"]').inputValue(),'Sun');
    assert.equal(await page.locator('scene-presets-card').nth(1).getByRole('button',{name:'Presets und Status aktualisieren'}).count(),1);
  }
  assert.equal(requests,requestsBeforeLanguageSwitch,'language changes must not reload metadata');
  assert.equal(await page.evaluate(()=>calls.length),callsBeforeLanguageSwitch,'language changes must not trigger scene actions');
  endpointStatus=200;
  await editor.getByRole('button',{name:'Erneut laden',exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector('scene-presets-editor').dataError);
  await card.getByRole('button',{name:'Presets und Status aktualisieren'}).click();
  await page.waitForFunction(()=>!document.querySelector('scene-presets-card').notices.has('presets'));


  // Display options round-trip through the editor without discarding custom properties.
  await editor.getByRole('checkbox',{name:'Szenentitel zentrieren',exact:true}).check();
  await editor.getByRole('checkbox',{name:'Szenen nach Kategorien unterteilen',exact:true}).check();
  await editor.getByRole('checkbox',{name:'Aktualisierungssymbol anzeigen',exact:true}).uncheck();
  assert.deepEqual(await page.evaluate(()=>[edited.display.center_titles,edited.display.group_by_category,edited.display.show_refresh,edited.preset_card.custom_property_xyz]),[true,true,false,7]);

  // Grouping follows visible presets and never creates empty category sections.
  await page.evaluate(()=>document.querySelector('scene-presets-card').setConfig({...config,display:{...config.display,center_titles:true,group_by_category:true,show_refresh:false}}));
  await card.locator('.category-heading').first().waitFor();
  assert.deepEqual(await card.locator('.category-heading').allTextContents(),['Relax','Party']);
  assert.equal(await card.getByRole('button',{name:'Presets und Status aktualisieren'}).count(),0);
  assert.equal(await card.locator('.name').first().evaluate(node=>getComputedStyle(node).textAlign),'center');
  assert.equal((await card.locator('#active .notice').innerText()).includes('↻'),false);
  await card.getByRole('searchbox',{name:'Presets suchen'}).fill('Party');
  await page.waitForFunction(()=>document.querySelector('scene-presets-card').shadowRoot.querySelectorAll('.preset-group').length===1);
  assert.deepEqual(await card.locator('.category-heading').allTextContents(),['Party']);
  await card.getByRole('searchbox',{name:'Presets suchen'}).fill('no-such-scene');
  await page.waitForFunction(()=>document.querySelector('scene-presets-card').shadowRoot.querySelectorAll('.preset-group').length===0);
  await card.getByText('Keine passenden Presets.',{exact:true}).waitFor();
  await page.evaluate(()=>document.querySelector('scene-presets-card').setConfig({...config,filter:{mode:'include',presets:['x']},display:{...config.display,center_titles:true,group_by_category:true,show_refresh:false}}));
  await card.locator('.category-heading').first().waitFor();
  assert.deepEqual(await card.locator('.category-heading').allTextContents(),['Relax']);
  assert.equal(await card.locator('.tile').count(),1);

  assert.deepEqual(errors,[]);
  endpointStatus=200;
  await page.unroute('**/assets/scene_presets/scene_presets.json');
  await page.route('**/assets/scene_presets/scene_presets.json',route=>route.fulfill({json:previewData}));
  const previewConfig={
    type:'custom:scene-presets-card',title:'Living room scenes',
    targets:{entity_id:['light.ceiling','light.floor_lamp','light.ambient']},
    filter:{mode:'exclude',categories:[],presets:[]},
    scene:{mode:'normal',shuffle:true,smart_shuffle:true,brightness:{override:true,value:180},transition:{override:true,value:5},interval:120},
    controls:{mode:true,shuffle:true,smart_shuffle:true,brightness:true,brightness_input:'slider',transition:true,interval:true},
    favorites:{enabled:true,mode:'user',namespace:'living-room'},remember:{controls:true},storage_key:'living-room-scenes',
    display:{columns:3,show_title:true,show_name:true,center_titles:true,group_by_category:true,show_category:true,show_refresh:true,search:true,category_selector:true,favorites:true,active_scene:true}
  };
  await page.evaluate(({previewConfig,activePreset})=>{
    document.body.replaceChildren(); stored.clear(); subscribers.clear();
    const previewHass={...hassMock,locale:{language:'en'},states:{
      'light.ceiling':{state:'on',attributes:{friendly_name:'Ceiling'}},
      'light.floor_lamp':{state:'on',attributes:{friendly_name:'Floor lamp'}},
      'light.ambient':{state:'on',attributes:{friendly_name:'Ambient light'}},
    },callWS:async msg=>{
      if(msg.type==='scene_presets/get_dynamic_scenes')return {dynamic_scenes:[{id:'preview-dynamic',running:true,interval:120,parameters:{preset_id:activePreset,light_entity_ids:['light.ceiling','light.floor_lamp'],transition:60}}]};
      if(msg.type.includes('/set_')){stored.set(msg.key,msg.value);subscribers.get(msg.key)?.forEach(cb=>cb({value:msg.value}));return;}
      return {value:stored.get(msg.key)??null};
    }};
    window.previewConfig=previewConfig; window.previewHass=previewHass;
    const frame=document.createElement('main');frame.id='preview';
    const preview=document.createElement('scene-presets-card');preview.setConfig(previewConfig);preview.hass=previewHass;frame.append(preview);document.body.append(frame);
  },{previewConfig,activePreset:previewData.presets[0].id});
  const preview=page.locator('#preview scene-presets-card');
  await preview.evaluate(card=>card.loadPresets(true));
  await page.waitForFunction(expected=>document.querySelector('#preview scene-presets-card').shadowRoot.querySelectorAll('.tile').length===expected,previewData.presets.length);
  await preview.locator('img').evaluateAll(images=>Promise.all(images.map(img=>img.complete ? undefined : new Promise(resolve=>img.addEventListener('load',resolve,{once:true})))));
  assert.equal(await preview.locator('.tile img').count(),previewData.presets.length,'README preview uses real preset images');
  assert.equal(await preview.locator('.preset-group').count(),previewData.categories.length,'README preview shows configured category groups');
  await page.locator('#preview').screenshot({path:root+'tests/browser-preview.png'});

  await page.evaluate(()=>{
    document.body.replaceChildren();
    const previewEditor=document.createElement('scene-presets-editor');
    previewEditor.sectionStates=new Map(['targets','filter','categories','presets','scene','display','controls','favorites','remember','renderer','diagnostics'].map(key=>[key,true]));
    previewEditor.setConfig(previewConfig);previewEditor.hass={...previewHass,locale:{language:'en'}};document.body.append(previewEditor);
  });
  const previewEditor=page.locator('scene-presets-editor');
  await previewEditor.getByText('6 of 6 presets available for this card',{exact:true}).waitFor({state:'attached'});
  await previewEditor.screenshot({path:root+'tests/editor-preview.png'});
  console.log('Browser contracts passed: shared cache, tap/favorite isolation, live sync, search, dynamic/stop, fallback, persistence, editor preservation, child renderer.');
} finally {await browser?.close();await new Promise(resolve=>server.close(resolve));}
