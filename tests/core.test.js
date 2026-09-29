import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ScenePresetsAdapter} from '../src/adapters/scene-presets-adapter.js';
import {HaStorageAdapter} from '../src/adapters/ha-storage-adapter.js';
import {FavoritesStore, parseFavorites} from '../src/services/favorites-store.js';
import {PresetCache, getPresetCache} from '../src/services/preset-cache.js';
import {normalizeConfig, normalizeScene} from '../src/models/card-config.js';
import {filterPresets, missingIds} from '../src/utils/validation.js';
import {fingerprint} from '../src/utils/hashing.js';
import {rendererConfig} from '../src/adapters/button-card-adapter.js';
const target = {entity_id:['light.one','light.two']};
const raw = {categories:[{id:'a',name:'Relax'},{id:'b',name:'Party'}],presets:[{id:'x',name:'Sunset',categoryId:'a',img:'x.jpeg',bri:180},{id:'y',name:'Custom',categoryId:'b',custom:true}]};
const fake = (data = raw) => new ScenePresetsAdapter({services:{scene_presets:{apply_preset:{},start_dynamic_scene:{},stop_dynamic_scene:{}}}}, async () => ({ok:true,json:async()=>structuredClone(data)}));
test('minimal config, target groups and validation', () => {
  assert.equal(normalizeConfig({targets:target}).scene.mode,'normal');
  assert.equal(normalizeConfig({targets:target}).display.show_title,true);
  assert.equal(normalizeConfig({targets:target}).controls.brightness_input,'number');
  assert.equal(normalizeConfig({targets:target,controls:{brightness_input:'slider'}}).controls.brightness_input,'slider');
  assert.deepEqual(normalizeConfig({targets:{entity_id:'group.lights'}}).targets.entity_id,['group.lights']);
  for (const config of [{targets:{entity_id:[]}}, {targets:{entity_id:['switch.x']}}, {targets:target,filter:{mode:'both'}}, {targets:target,remember:{controls:true}}, {targets:target,controls:{brightness_input:'dial'}}, {targets:target,display:{show_title:'yes'}}, {targets:target,scene:{brightness:{override:true,value:0}}}]) assert.throws(()=>normalizeConfig(config));
});
test('exact normal payload and override omission', () => {
  const adapter = fake();
  assert.deepEqual(adapter.buildCall('x',target,{}),{domain:'scene_presets',service:'apply_preset',data:{preset_id:'x',targets:target,shuffle:false,smart_shuffle:false}});
  const call = adapter.buildCall('x',target,{shuffle:true,smart_shuffle:true,brightness:{override:true,value:80},transition:{override:true,value:5}});
  assert.equal(call.data.brightness,80); assert.equal(call.data.transition,5); assert.equal(call.data.smart_shuffle,true);
  assert.equal('brightness' in adapter.buildCall('x',target,{brightness:{override:false,value:80}}).data,false);
});
test('dynamic delegates shuffle and preserves transition after normalization', () => {
  const call = fake().buildCall('x',target,normalizeScene({mode:'dynamic',interval:120,dynamic_transition:60,shuffle:true}));
  assert.deepEqual(call.data,{preset_id:'x',targets:target,interval:120,transition:60});
  assert.equal(call.service,'start_dynamic_scene');
  assert.throws(()=>normalizeScene({mode:'dynamic',transition:30}),/scene\.transition/);
  assert.throws(()=>fake().buildCall('x',target,{mode:'dynamic',interval:0}));
});
test('central calls and missing capabilities', async () => {
  const adapter=fake(); const calls=[]; adapter.hass.callService=(...args)=>calls.push(args);
  await adapter.applyPreset('x',target,{}); await adapter.stopDynamicScene('uuid');
  assert.deepEqual(calls[1],['scene_presets','stop_dynamic_scene',{id:'uuid'}]);
  delete adapter.hass.services.scene_presets.apply_preset;
  await assert.rejects(adapter.applyPreset('x',target,{}),/unavailable/);
});
test('normalize custom and missing/unsafe image, 0/1/many presets', async () => {
  for (const count of [0,1,500]) {
    const data={categories:raw.categories,presets:Array.from({length:count},(_,i)=>({...raw.presets[i%2],id:String(i)}))};
    const snapshot=await new PresetCache().load(fake(data)); assert.equal(snapshot.presets.length,count);
    if(count) assert.equal(snapshot.presets[0].picture,'/assets/scene_presets/x.jpeg');
  }
  const snapshot=await new PresetCache().load(fake()); assert.equal(snapshot.presets[1].raw.custom,true); assert.equal(snapshot.presets[1].picture,null);
  assert.equal(fake().normalizePreset({...raw.presets[0],img:'../secret'},new Map()).picture,null);
});
test('include/exclude union then runtime filters, missing IDs retained', async () => {
  const data=await new PresetCache().load(fake());
  const run=(mode,categories=[],presets=[],runtime={})=>filterPresets(data.presets,{mode,categories,presets},runtime,['y']).map(p=>p.id);
  assert.deepEqual(run('include'),[]); assert.deepEqual(run('exclude'),['x','y']);
  assert.deepEqual(run('include',['a']),['x']); assert.deepEqual(run('include',[],['y']),['y']); assert.deepEqual(run('include',['a'],['y']),['x','y']);
  assert.deepEqual(run('exclude',['a']),['y']); assert.deepEqual(run('exclude',[],['x']),['y']);
  assert.deepEqual(run('exclude',[],['y'],{favorites:true}),[]); assert.deepEqual(run('exclude',[],[],{search:'relax'}),['x']);
  assert.deepEqual(missingIds(normalizeConfig({targets:target,filter:{presets:['gone'],categories:['missing']}}),data),['Missing preset: gone','Missing category: missing']);
});
test('fingerprint ignores collection order but catches custom changes/category changes', async () => {
  assert.equal(await fingerprint(raw),await fingerprint({categories:[...raw.categories].reverse(),presets:[...raw.presets].reverse()}));
  const changed=structuredClone(raw); changed.presets[1].name='Edited'; assert.notEqual(await fingerprint(raw),await fingerprint(changed));
  changed.categories[0].name='New'; assert.notEqual(await fingerprint(raw),await fingerprint(changed));
});
test('cache deduplicates, reuses identities, adds/removes, keeps valid data on failures', async () => {
  const cache=new PresetCache(); let requests=0; let data=structuredClone(raw);
  const adapter=fake(); adapter.fetcher=async()=>{requests++;return {ok:true,json:async()=>data};};
  const [a,b]=await Promise.all([cache.load(adapter),cache.load(adapter)]); assert.equal(a,b); assert.equal(requests,1);
  const original=a.presets; await cache.load(adapter,true); assert.equal(cache.snapshot.presets,original);
  data={...data,presets:[data.presets[0]]}; await cache.load(adapter,true); assert.equal(cache.snapshot.presets.length,1);
  data={...data,presets:raw.presets}; await cache.load(adapter,true); assert.equal(cache.snapshot.presets.length,2);
  data={bad:true}; await assert.rejects(cache.load(adapter,true)); assert.equal(cache.snapshot.presets.length,2);
  assert.equal(getPresetCache('same'),getPresetCache('same')); assert.notEqual(getPresetCache('same'),getPresetCache('other'));
});
test('malformed endpoint, duplicate ids and HTTP failure', async () => {
  await assert.rejects(fake({presets:null,categories:[]}).loadPresets());
  await assert.rejects(fake({...raw,presets:[raw.presets[0],raw.presets[0]]}).loadPresets(),/duplicate/);
  const adapter=fake(); adapter.fetcher=async()=>({ok:false,status:404}); await assert.rejects(adapter.loadPresets(),/404/);
});
test('status is parsed from upstream, status failure removes capability', async () => {
  const adapter=fake(); adapter.hass.callWS=async()=>({dynamic_scenes:[{id:'d',running:true,interval:120,parameters:{preset_id:'x',light_entity_ids:['light.one'],transition:60}}]});
  assert.equal((await adapter.getActiveDynamicScenes())[0].presetId,'x'); assert.equal(adapter.getCapabilities().dynamicSceneStatus,true);
  adapter.hass.callWS=async()=>({}); await assert.rejects(adapter.getActiveDynamicScenes()); assert.equal(adapter.getCapabilities().dynamicSceneStatus,false);
});
test('user/global storage exact payload, rights and unavailable subscription', async () => {
  const calls=[]; const adapter=new HaStorageAdapter({user:{is_admin:false},callWS:async msg=>{calls.push(msg);return {value:null};}});
  await adapter.read('global','key'); assert.deepEqual(calls[0],{type:'frontend/get_system_data',key:'key'});
  await assert.rejects(adapter.write('global','key',{}),/administrator/);
  await adapter.write('user','key',{version:1}); assert.equal(calls[1].type,'frontend/set_user_data');
  assert.equal(await adapter.subscribe('user','key',()=>{}),null);
});
test('favorites namespaces, shared server data across browsers and user separation', async () => {
  const data=new Map();
  const forUser=user=>new HaStorageAdapter({user:{is_admin:true},callWS:async msg=>{
    const key=(msg.type.includes('system')?'global':user)+msg.key;
    if(msg.type.includes('/set_')) {data.set(key,msg.value);return;}
    return {value:data.get(key)??null};
  }});
  const a=new FavoritesStore(forUser('one'),{mode:'user',namespace:'default'});
  const b=new FavoritesStore(forUser('one'),{mode:'user',namespace:'default'});
  await a.toggle('x'); await b.load(()=>{}); assert.deepEqual(b.ids,['x']);
  const c=new FavoritesStore(forUser('two'),{mode:'user',namespace:'default'}); await c.load(()=>{}); assert.deepEqual(c.ids,[]);
  const d=new FavoritesStore(forUser('one'),{mode:'user',namespace:'room'}); await d.load(()=>{}); assert.deepEqual(d.ids,[]);
  await Promise.all([a.toggle('y'),a.toggle('z')]); assert.deepEqual(a.ids,['x','y','z']);
  assert.throws(()=>parseFavorites({version:2,favorites:[]}));
});
test('favorites close ignores late subscription updates and unsubscribes once', async () => {
  let subscriptionCallback, resolveSubscription, markStarted;
  let updates=0, errors=0, unsubscribes=0;
  const started=new Promise(resolve=>{markStarted=resolve;});
  const adapter={
    read:async()=>null,
    subscribe:async(_mode,_key,listener)=>{
      subscriptionCallback=listener; markStarted();
      return new Promise(resolve=>{resolveSubscription=()=>resolve(()=>{unsubscribes++;});});
    },
  };
  const store=new FavoritesStore(adapter,{mode:'user',namespace:'lifecycle'});
  const loading=store.load(()=>{updates++;},()=>{errors++;});
  await started; store.close();
  subscriptionCallback({version:2,favorites:[]});
  resolveSubscription(); await loading; store.close();
  assert.equal(updates,1); assert.equal(errors,0); assert.equal(unsubscribes,1); assert.equal(store.live,false);
});
test('renderer variables and disabled actions preserve unknown config', () => {
  const result=rendererConfig({type:'custom:button-card',template:'scene',custom_property_xyz:42,tap_action:{action:'toggle'}},{id:'x',name:'Sunset',picture:null},'dynamic');
  assert.equal(result.custom_property_xyz,42); assert.equal(result.variables.preset.id,'x'); assert.equal(result.variables.card.sceneMode,'dynamic'); assert.equal(result.tap_action.action,'none');
});

test('category navigation only includes categories populated after the config filter', async () => {
  const {availableCategories} = await import('../src/utils/validation.js');
  const data = await new PresetCache().load(fake());
  data.categories.push({id:'empty',name:'Empty'});
  const choose = (mode, categories = [], presets = []) => availableCategories(data,{mode,categories,presets}).map(c=>c.id);
  assert.deepEqual(choose('include',[],['x']),['a']);
  assert.deepEqual(choose('include',['a'],['y']),['a','b']);
  assert.deepEqual(choose('include'),[]);
  assert.deepEqual(choose('exclude',[],['x']),['b']);
  assert.deepEqual(choose('exclude',['a']),['b']);
  assert.deepEqual(choose('exclude'),['a','b']);
  assert.deepEqual(choose('include',[],['deleted']),[]);
});
test('404 explains integration activation; other HTTP errors do not claim missing setup', async () => {
  const adapter=fake();
  adapter.fetcher=async()=>({ok:false,status:404});
  await assert.rejects(adapter.loadPresets(), error => error.message.includes('HTTP 404') &&
    error.message.includes('not be activated') && error.message.includes('Add integration') &&
    error.message.includes('HACS alone is not enough'));
  adapter.fetcher=async()=>({ok:false,status:500});
  await assert.rejects(adapter.loadPresets(), error => error.message.includes('HTTP 500') && !error.message.includes('not be activated'));
});
