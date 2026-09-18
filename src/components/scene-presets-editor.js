import {localize} from '../localize/localize.js';
import {haLanguage} from '../adapters/ha-localization-adapter.js';
import {VERSION} from '../version.js';
import {el, button, field, styles} from '../utils/dom.js';
import {LovelaceCardAdapter} from '../adapters/lovelace-card-adapter.js';
import {ScenePresetsAdapter} from '../adapters/scene-presets-adapter.js';
import {PresetProvider} from '../services/preset-provider.js';
import {normalizeScene, normalizeConfig} from '../models/card-config.js';
import {missingIds, filterPresets} from '../utils/validation.js';
import {runtimeControls} from './runtime-controls.js';

export function setConfigPath(config, path, value) {
  const next = structuredClone(config); let cursor = next;
  const parts = path.split('.');
  for (const key of parts.slice(0,-1)) { cursor[key] = {...cursor[key]}; cursor = cursor[key]; }
  cursor[parts.at(-1)] = value; return next;
}
/**
 * EXTERNAL API
 * Project: Home Assistant Lovelace
 * Purpose: Visual editor configuration updates.
 * Upstream interface: bubbling/composed config-changed {config}; setConfig, hass.
 * Breaking-change risks: editor lifecycle/event contract.
 * Verified against: Custom card developer documentation, 2026-09-18.
 */
export class ScenePresetsEditor extends HTMLElement {
  constructor() {
    super(); this.attachShadow({mode: 'open'}); this.adapter = new LovelaceCardAdapter();
    this.sectionStates = new Map(); this.searches = new Map();
  }
  static get version() { return VERSION; }
  setConfig(config) { this.config = structuredClone(config); this.render(); }
  get t() { return localize(this._hass); }
  set hass(hass) {
    const language = haLanguage(hass); const changed = language !== this.language;
    this.language = language; this._hass = hass;
    if (!this.loadStarted) this.load();
    if (changed) this.render();
    for (const selector of this.shadowRoot.querySelectorAll('ha-selector')) selector.hass = hass;
  }
  async load(force = false) {
    if (this.loading) return;
    this.loading = true; this.loadStarted = true;
    try { await this.adapter.ensureEditorComponents(); this.componentError = null; }
    catch (error) { this.componentError = error; }
    try {
      this.data = await new PresetProvider(new ScenePresetsAdapter(this._hass)).load(force);
      this.dataError = null;
    } catch (error) { this.dataError = error; }
    this.loading = false; this.render();
  }
  change(path, value) { this.commit(setConfigPath(this.config, path, value)); }
  commit(config) {
    this.config = config;
    this.dispatchEvent(new CustomEvent('config-changed', {detail: {config: structuredClone(config)}, bubbles: true, composed: true}));
    this.render();
  }
  section(key, title, description, children, initiallyOpen = false) {
    const details = el('details', {class: 'editor-section', open: this.sectionStates.get(key) ?? initiallyOpen});
    details.dataset.section = key;
    details.append(el('summary', {}, [el('span', {text: title})]),
      el('div', {class: 'section-body'}, [el('p', {class: 'help', text: description}), ...children]));
    return details;
  }
  check(label, path, value) { return field(label, el('input', {type: 'checkbox', checked: !!value, onchange: e => this.change(path, e.target.checked)})); }
  text(label, path, value) { return field(label, el('input', {value: value ?? '', onchange: e => this.change(path, e.target.value)})); }
  select(label, path, value, options) {
    return field(label, el('select', {onchange: e => this.change(path, e.target.value)}, options.map(([id, name]) => el('option', {value: id, text: name, selected: id === value}))));
  }
  listSelector(kind, items) {
    const selected = this.config.filter?.[kind] || [];
    const list = el('div', {class: 'choices'});
    const query = this.searches.get(kind) || '';
    const search = el('input', {type: 'search', value: query, placeholder: this.t('editor.search_placeholder'), 'aria-label': kind === 'presets' ? this.t('editor.search_presets') : this.t('editor.search_categories'), oninput: e => {
      this.searches.set(kind, e.target.value);
      for (const row of list.children) row.hidden = !row.dataset.search.includes(e.target.value.toLocaleLowerCase());
    }});
    for (const item of items) {
      const checkbox = el('input', {type: 'checkbox', checked: selected.includes(item.id), 'aria-label': item.name, onchange: e => {
        const current = this.config.filter?.[kind] || [];
        this.change(`filter.${kind}`, e.target.checked ? [...new Set([...current, item.id])] : current.filter(id => id !== item.id));
      }});
      const label = el('label', {}, [checkbox]);
      if (item.picture) label.append(el('img', {src: item.picture, loading: 'lazy', alt: '', width: 40, height: 28}));
      label.append(el('span', {}, [el('span', {class: 'choice-name', text: item.name, title: item.id}),
        ...(item.categoryName ? [el('small', {text: item.categoryName})] : [])]));
      label.dataset.search = `${item.name} ${item.categoryName || ''} ${item.id}`.toLocaleLowerCase();
      label.hidden = !label.dataset.search.includes(query.toLocaleLowerCase()); list.append(label);
    }
    const details = el('details', {class: 'selection', open: this.sectionStates.get(kind) ?? false}, [
      el('summary', {text: this.t('editor.selected', {label: this.t(kind === 'presets' ? 'editor.presets' : 'editor.categories'), count: selected.length})}), search, list,
      ...(!items.length ? [el('p', {class: 'help', text: this.t('editor.no_entries')})] : []),
    ]);
    details.dataset.section = kind; return details;
  }
  render() {
    if (!this.config || !this._hass) return;
    for (const section of this.shadowRoot.querySelectorAll('details[data-section]')) this.sectionStates.set(section.dataset.section, section.open);
    const c = this.config;
    const root = el('div', {class: 'editor'});
    root.append(el('header', {}, [el('h2', {text: 'Scene Presets'}), el('p', {class: 'help', text: this.t('editor.intro')})]));
    let valid;
    try { valid = normalizeConfig(c); } catch (error) { root.append(el('p', {class: 'notice error', text: this.t.render(error)})); }
    if (this.componentError) root.append(el('p', {class: 'notice error', text: this.t.render(this.componentError)}));
    if (this.dataError) root.append(el('div', {class: 'error-box', role: 'alert'}, [
      el('p', {class: 'notice error', text: this.t.render(this.dataError)}), button(this.t('common.reload'), () => this.load(true), {disabled: this.loading}),
    ]));
    if (valid && this.data) for (const message of missingIds(valid, this.data, this.t)) root.append(el('p', {class: 'notice error', text: message}));
    root.append(this.section('targets', this.t('editor.targets'), this.t('editor.targets_help'), [
      this.adapter.entitySelector(this._hass, typeof c.targets?.entity_id === 'string' ? [c.targets.entity_id] : c.targets?.entity_id || [], value => this.change('targets.entity_id', value)),
    ], true));
    const count = valid && this.data ? filterPresets(this.data.presets, valid.filter).length : null;
    root.append(this.section('filter', this.t('editor.filter'), this.t('editor.filter_help'), [
      this.select(this.t('editor.filter_mode'), 'filter.mode', c.filter?.mode || 'exclude', [['exclude',this.t('editor.exclude')],['include',this.t('editor.include')]]),
      el('p', {class: 'help', text: c.filter?.mode === 'include' ? this.t('editor.empty_include') : this.t('editor.empty_exclude')}),
      ...(count !== null ? [el('p', {class: 'count', text: this.t('editor.available', {count, total: this.data.presets.length})})] : []),
      this.listSelector('categories', this.data?.categories || []), this.listSelector('presets', this.data?.presets || []),
    ]));
    let scene;
    try { scene = normalizeScene(c.scene); } catch { scene = normalizeScene(); }
    root.append(this.section('scene', this.t('editor.scene'), this.t('editor.scene_help'), [
      runtimeControls(scene, {mode:true,shuffle:true,smart_shuffle:true,brightness:true,transition:true,interval:true}, {normalScenes:true,dynamicScenes:true}, value => {
        this.commit({...this.config, scene: {...this.config.scene, ...value, transition: value.mode === 'dynamic' ? value.dynamic_transition : value.transition}});
      }, this.t),
    ]));
    root.append(this.section('display', this.t('editor.display'), this.t('editor.display_help'), [
      this.text(this.t('editor.title'), 'title', c.title), field(this.t('editor.columns'), el('input', {type:'number', min:1, max:12, value:c.display?.columns ?? 3,
        onchange:e => { if (e.target.reportValidity()) this.change('display.columns', Number(e.target.value)); }})),
      ...Object.entries({show_name:this.t('editor.show_name'),center_titles:this.t('editor.center_titles'),group_by_category:this.t('editor.group_by_category'),show_category:this.t('editor.show_category'),show_refresh:this.t('editor.show_refresh'),search:this.t('editor.show_search'),category_selector:this.t('editor.category_selector'),favorites:this.t('editor.show_favorites'),active_scene:this.t('editor.active_scene')})
        .map(([key,label]) => this.check(label, `display.${key}`, c.display?.[key] ?? ['show_name','favorites','show_refresh'].includes(key))),
      el('p', {class: 'help', text: this.t('editor.refresh_help')}),
    ]));
    root.append(el('h3', {class: 'group-title', text: this.t('editor.optional')}));
    root.append(this.section('controls', this.t('editor.controls'), this.t('editor.controls_help'),
      Object.entries({mode:this.t('editor.control_mode'),shuffle:this.t('editor.control_shuffle'),smart_shuffle:this.t('editor.control_smart_shuffle'),brightness:this.t('editor.control_brightness'),transition:this.t('editor.control_transition'),interval:this.t('editor.control_interval')})
        .map(([key,label]) => this.check(label, `controls.${key}`, c.controls?.[key]))));
    root.append(this.section('favorites', this.t('common.favorites'), this.t('editor.favorites_help'), [
      this.check(this.t('editor.favorites_enabled'), 'favorites.enabled', c.favorites?.enabled),
      ...(c.favorites?.enabled ? [
        this.select(this.t('editor.storage'), 'favorites.mode', c.favorites?.mode || 'user', [['user',this.t('editor.storage_user')],['global',this.t('editor.storage_global')]]),
        ...(c.favorites?.mode === 'global' ? [el('p', {class: 'help', text: this.t('editor.admin_help')})] : []),
        this.text(this.t('editor.namespace'), 'favorites.namespace', c.favorites?.namespace ?? 'default'),
        el('p', {class: 'help', text: this.t('editor.namespace_help')}),
      ] : []),
    ]));
    root.append(this.section('remember', this.t('editor.remember'), this.t('editor.remember_help'), [
      this.check(this.t('editor.remember_controls'), 'remember.controls', c.remember?.controls),
      ...(c.remember?.controls ? [this.text(this.t('editor.storage_key'), 'storage_key', c.storage_key),
        el('p', {class: 'help', text: this.t('editor.storage_key_help')})] : []),
    ]));
    const rendererType = c.preset_card?.type || 'internal';
    const custom = !['internal','custom:button-card'].includes(rendererType);
    const rendererSelect = el('select', {onchange: e => this.change('preset_card.type', e.target.value === 'custom' ? 'custom:' : e.target.value)}, [
      el('option', {value:'internal',text:this.t('editor.internal'),selected:rendererType === 'internal'}),
      el('option', {value:'custom:button-card',text:'Button Card',selected:rendererType === 'custom:button-card'}),
      el('option', {value:'custom',text:this.t('editor.custom_card'),selected:custom}),
    ]);
    root.append(this.section('renderer', this.t('editor.renderer'), this.t('editor.renderer_help'), [
      field(this.t('editor.renderer_label'), rendererSelect),
      ...(custom ? [this.text(this.t('editor.custom_type'), 'preset_card.type', rendererType)] : []),
      ...(rendererType !== 'internal' ? [this.text(this.t('editor.template'), 'preset_card.template', c.preset_card?.template),
        el('p', {class: 'help', text: this.t('editor.external_help')})] : []),
    ]));
    root.append(this.section('diagnostics', this.t('editor.diagnostics'), this.t('editor.diagnostics_help'), [this.check(this.t('editor.debug'), 'debug', c.debug)]));
    root.append(el('p', {class: 'help version', text: `Scene Presets Card · ${VERSION}`}));
    this.shadowRoot.replaceChildren(el('style', {text: styles + editorStyles}), root);
  }
}
const editorStyles = `
  .editor{padding:4px;max-width:680px;margin:auto}header{padding:4px 0 12px}
  .help{color:var(--secondary-text-color,#666);font-size:13px;line-height:1.5;margin:0 0 14px}
  .editor-section{border:1px solid var(--divider-color,#ddd);border-radius:12px;margin:10px 0;overflow:hidden}
  .editor-section>summary{padding:16px;font-weight:600;background:var(--secondary-background-color,#f6f7f8)}
  .editor-section[open]>summary{border-bottom:1px solid var(--divider-color,#ddd)}
  .section-body{padding:16px}.section-body>label{padding:9px 0;margin:0;min-height:44px;gap:16px}
  .section-body>label>span{flex:1;line-height:1.4}input,select{min-height:40px;max-width:100%;min-width:0}
  input[type=checkbox]{flex:0 0 auto;width:20px;min-height:20px;accent-color:var(--primary-color,#03a9f4)}
  label>input:not([type=checkbox]),label>select{max-width:58%}
  .controls{grid-template-columns:1fr;margin:0}.controls label{min-height:44px}
  .group-title{font-size:13px;color:var(--secondary-text-color,#666);margin:24px 4px 8px}
  .selection{border-top:1px solid var(--divider-color,#ddd);padding-top:12px}
  .selection summary{padding:6px 0 12px}.selection input[type=search]{width:100%;margin-bottom:8px}
  .choices{max-height:280px;overflow:auto}.choices label{justify-content:flex-start;padding:8px;margin:0;gap:10px}
  .choices label[hidden]{display:none}.choices label:hover{background:var(--secondary-background-color,#eee)}
  .choices label>span{flex:1}.choice-name{display:block}.choices small{display:block;color:var(--secondary-text-color,#666)}
  .choices img{object-fit:cover;border-radius:5px}.count{font-size:13px;font-weight:600}
  .error-box{padding:12px;border:1px solid var(--error-color,#db4437);border-radius:10px;margin-bottom:16px}
  ha-selector{display:block;width:100%}
  @media(max-width:420px){.section-body>label:not(:has(input[type=checkbox])){align-items:stretch;flex-direction:column;gap:6px}.section-body>label>input,.section-body>label>select{max-width:100%;width:100%}}
`;
