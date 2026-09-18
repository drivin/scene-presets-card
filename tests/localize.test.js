import {test} from 'node:test';
import assert from 'node:assert/strict';
import {languages, localize, resolveLanguage, message, LocalizedError} from '../src/localize/localize.js';
import {ScenePresetsAdapter} from '../src/adapters/scene-presets-adapter.js';
import {normalizeConfig} from '../src/models/card-config.js';
import {missingIds} from '../src/utils/validation.js';

const forLanguage = language => localize({locale: {language}});
test('all language catalogs have complete keys and matching named placeholders', () => {
  const placeholders = text => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
  for (const [language, catalog] of Object.entries(languages)) {
    assert.deepEqual(Object.keys(catalog).sort(), Object.keys(languages.en).sort(), language);
    for (const [key, value] of Object.entries(catalog)) {
      assert.equal(typeof value, 'string'); assert.ok(value.trim(), `${language}: ${key}`);
      assert.deepEqual(placeholders(value), placeholders(languages.en[key]), `${language}: ${key}`);
    }
  }
});
test('HA profile language, legacy language and regional variants with English fallback', () => {
  for (const language of [undefined, '', 'es', 'constructor', '__proto__']) assert.equal(resolveLanguage(language), 'en');
  assert.equal(localize()('common.category'), 'Category');
  assert.equal(forLanguage('de-DE')('common.category'), 'Kategorie');
  assert.equal(forLanguage('nl_BE')('common.category'), 'Categorie');
  assert.equal(forLanguage('FR-ca')('common.category'), 'Catégorie');
  assert.equal(localize({language:'de'})('common.category'), 'Kategorie');
  assert.equal(localize({locale:{language:'fr'},language:'de'})('common.category'), 'Catégorie');
  const english = languages.nl['card.empty'];
  try { delete languages.nl['card.empty']; assert.equal(forLanguage('nl')('card.empty'), languages.en['card.empty']); }
  finally { languages.nl['card.empty'] = english; }
  assert.equal(forLanguage('de')('unknown.key'), 'unknown.key');
});
test('translation is per instance and interpolation does not interpret names as templates', () => {
  const de=forLanguage('de'), fr=forLanguage('fr');
  assert.equal(de('card.apply',{name:'{name} $& <script>'}), '{name} $& <script> anwenden');
  assert.equal(fr('card.apply',{name:'Sunset'}), 'Appliquer Sunset');
  assert.equal(de('card.apply',{name:'Sunset'}), 'Sunset anwenden');
});
test('shared errors remain localizable after loading, including activation hints', async () => {
  const adapter=new ScenePresetsAdapter({},async()=>({ok:false,status:404}));
  let failure;
  try { await adapter.loadPresets(); } catch(error) {failure=error;}
  assert.ok(failure instanceof LocalizedError);
  const notice=message('notice.presets',{error:failure,cache:message('notice.cache')});
  for(const [language,hint] of [['en','Add integration'],['de','Integration hinzufügen'],['nl','Integratie toevoegen'],['fr','Ajouter une intégration']]) {
    const text=forLanguage(language).render(notice);
    assert.ok(text.includes(hint),language); assert.ok(text.includes('HTTP 404')); assert.ok(!text.includes('{error}'));
  }
  const rawError=new Error('Unmodified upstream error');
  assert.equal(forLanguage('fr').render(rawError),'Unmodified upstream error');
});
test('validation and missing IDs are translated while data and identifiers remain unchanged', () => {
  assert.throws(()=>normalizeConfig({targets:{entity_id:[]}}),error=>forLanguage('fr').render(error).includes('Au moins une cible'));
  assert.deepEqual(missingIds({filter:{presets:['x'],categories:['a']}},{presets:[],categories:[]},forLanguage('nl')),['Ontbrekende preset: x','Ontbrekende categorie: a']);
  const normalized=new ScenePresetsAdapter({}).normalizePreset({id:'x',name:'Original name'},new Map());
  assert.equal(normalized.name,'Original name'); assert.equal(normalized.categoryName,'');
});
