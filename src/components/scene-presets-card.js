import {localize, message, LocalizedError} from '../localize/localize.js';
import {haLanguage} from '../adapters/ha-localization-adapter.js';
import {VERSION} from '../version.js';
import {ScenePresetsAdapter} from '../adapters/scene-presets-adapter.js';
import {HaStorageAdapter} from '../adapters/ha-storage-adapter.js';
import {LovelaceCardAdapter} from '../adapters/lovelace-card-adapter.js';
import {PresetProvider} from '../services/preset-provider.js';
import {CompatibilityService} from '../services/compatibility-service.js';
import {FavoritesStore} from '../services/favorites-store.js';
import {RuntimeStore} from '../services/runtime-store.js';
import {normalizeConfig, normalizeScene} from '../models/card-config.js';
import {filterPresets, missingIds, availableCategories} from '../utils/validation.js';
import {el, button, styles} from '../utils/dom.js';
import {runtimeControls} from './runtime-controls.js';
import {presetGrid} from './preset-grid.js';
import {activeScenePanel} from './active-scene-panel.js';

export class ScenePresetsCard extends HTMLElement {
  constructor() {
    super(); this.attachShadow({mode: 'open'}); this.renderer = new LovelaceCardAdapter();
    this.runtime = {}; this.favorites = []; this.active = []; this.notices = new Map(); this.generation = 0;
  }
  static get version() { return VERSION; }
  static getConfigElement() { return document.createElement('scene-presets-editor'); }
  static getStubConfig(hass) { return {type: 'custom:scene-presets-card', targets: {entity_id: Object.keys(hass?.states || {}).filter(id => id.startsWith('light.')).slice(0,1)}}; }
  getCardSize() { return 5; }
  setConfig(config) {
    try { this.config = normalizeConfig(config); } catch (error) { throw new Error(this.t.render(error)); }
    this.scene = structuredClone(this.config.scene);
    this.runtime = {}; this.restart();
  }
  get t() { return localize(this._hass); }
  set hass(hass) {
    const language = haLanguage(hass); const languageChanged = this.language !== language; this.language = language;
    const changedUser = this._hass && (this._hass.user?.id !== hass.user?.id || this._hass.connection !== hass.connection);
    this._hass = hass;
    if (changedUser) { this.restart(); return; }
    if (this.adapter) { this.adapter.hass = hass; this.storage.hass = hass; }
    for (const tile of this.shadowRoot.querySelectorAll('.tile')) if (tile.childCard) this.renderer.update(tile.childCard, hass);
    this.start();
    if (languageChanged) this.render();
  }
  connectedCallback() { this.start(); }
  disconnectedCallback() { this.cleanup(); }
  cleanup() {
    this.generation++; this.started = false; this.unsubscribe?.(); this.unsubscribe = null;
    this.favoriteStore?.close(); clearTimeout(this.searchTimer);
  }
  restart() {
    this.cleanup(); this.notices.clear(); this.favorites = []; this.active = []; this.timestamp = null;
    this.favoriteStore = null; this.runtimeStore = null; this.favoriteReady = false; this.data = null;
    this.render(); this.start();
  }
  async start() {
    if (this.started || !this.isConnected || !this.config || !this._hass) return;
    this.started = true; const generation = this.generation;
    this.adapter = new ScenePresetsAdapter(this._hass); this.storage = new HaStorageAdapter(this._hass);
    this.compatibility = new CompatibilityService(this.adapter, this.storage, this.renderer);
    this.provider = new PresetProvider(this.adapter);
    this.unsubscribe = this.provider.subscribe(data => { if (generation === this.generation) { this.data = data; this.render(); } });
    this.render();
    await Promise.allSettled([this.loadPresets(false, generation), this.loadFavorites(generation), this.loadRuntime(generation), this.refreshStatus(generation)]);
    if (generation === this.generation) this.render();
  }
  notice(key, message) { if (message) this.notices.set(key, message); else this.notices.delete(key); this.renderNotices(); }
  async loadPresets(force, generation = this.generation) {
    try { const data = await this.provider.load(force); if (generation !== this.generation) return; this.data = data; this.notice('presets', null); }
    catch (error) { if (generation !== this.generation) return; this.notice('presets', message('notice.presets', {error, cache: this.data ? message('notice.cache') : ''})); }
  }
  async loadFavorites(generation) {
    if (!this.config.favorites.enabled) return;
    const store = new FavoritesStore(this.storage, this.config.favorites); this.favoriteStore = store;
    try {
      await store.load(ids => { if (generation === this.generation) { this.favorites = ids; this.favoriteReady = true; this.renderGrid(); } }, error => this.notice('favorites', error));
      if (generation !== this.generation) return;
      this.notice('favorites', !this.storage.canWrite(this.config.favorites.mode) ? message('notice.global_readonly') : !store.live ? message('notice.no_live_sync') : null);
    } catch (error) { if (generation === this.generation) this.notice('favorites', message('notice.favorites', {error})); }
  }
  async loadRuntime(generation) {
    if (!this.config.remember?.controls) return;
    const store = new RuntimeStore(this.storage, this.config.storage_key); this.runtimeStore = store;
    try { const scene = await store.load(this.scene); if (generation === this.generation) this.scene = scene; }
    catch (error) { if (generation === this.generation) this.notice('runtime', message('notice.runtime', {error})); }
  }
  async refreshStatus(generation = this.generation) {
    if (!this.config.display.active_scene) return;
    try {
      const scenes = await this.adapter.getActiveDynamicScenes();
      if (generation !== this.generation) return;
      this.active = scenes.filter(s => s.running); this.timestamp = Date.now(); this.notice('status', null);
    } catch (error) {
      if (generation !== this.generation) return;
      this.active = []; this.timestamp = null; this.notice('status', message('notice.status', {error}));
    }
  }
  async refresh() {
    if (this.refreshing) return;
    this.refreshing = true;
    try { await Promise.allSettled([this.loadPresets(true), this.refreshStatus()]); this.render(); }
    finally { this.refreshing = false; }
  }
  async apply(preset) {
    if (this.busy) return;
    this.busy = true;
    try {
      const missing = this.config.targets.entity_id.filter(id => !this._hass.states?.[id]);
      if (missing.length) throw new LocalizedError('error.targets_missing', {ids: missing.join(', ')});
      if (this.scene.mode === 'dynamic') await this.adapter.startDynamicScene(preset.id, this.config.targets, this.scene);
      else await this.adapter.applyPreset(preset.id, this.config.targets, this.scene);
      this.notice('action', null); await this.refreshStatus(); this.renderActive(); this.renderGrid();
    } catch (error) { this.notice('action', message('notice.action', {error})); }
    finally { this.busy = false; }
  }
  async stop(id) {
    try { await this.adapter.stopDynamicScene(id); await this.refreshStatus(); this.renderActive(); this.renderGrid(); this.notice('action', null); }
    catch (error) { this.notice('action', message('notice.stop', {error})); }
  }
  async toggleFavorite(preset) {
    try { this.favorites = await this.favoriteStore.toggle(preset.id); this.renderGrid(); }
    catch (error) { this.notice('favorites', message('notice.favorite_save', {error})); }
  }
  changeScene(scene) {
    const modeChanged = this.scene.mode !== scene.mode;
    this.scene = normalizeScene(scene); this.renderControls();
    if (modeChanged) this.renderGrid();
    // Slider/input edits update only controls; tiles are unchanged.
    if (this.runtimeStore) this.runtimeStore.save(this.scene).catch(error => this.notice('runtime', message('notice.save', {error})));
  }
  renderNotices() {
    const node = this.shadowRoot.querySelector('#notices'); if (!node) return;
    const messages = [...this.notices.values()];
    if (this.data) messages.push(...missingIds(this.config, this.data, this.t));
    node.replaceChildren(...messages.map(text => el('p', {class: 'notice', text: this.t.render(text)})));
  }
  renderControls() {
    const node = this.shadowRoot.querySelector('#controls'); if (!node || !this.compatibility) return;
    node.replaceChildren(runtimeControls(this.scene, this.config.controls, this.compatibility.getCapabilities().scenePresets, scene => this.changeScene(scene), this.t));
  }
  renderActive() {
    const node = this.shadowRoot.querySelector('#active'); if (!node || !this.adapter) return;
    node.replaceChildren();
    if (this.config.display.active_scene) node.append(activeScenePanel(this.active, this.data?.presets || [], this._hass, this.timestamp, id => this.stop(id), this.adapter.getCapabilities().dynamicSceneStop, this.config.display.show_refresh, this.t));
  }
  renderGrid() {
    const node = this.shadowRoot.querySelector('#presets'); if (!node) return;
    if (!this.data) { node.replaceChildren(el('p', {text: this.notices.has('presets') ? (this.config.display.show_refresh ? this.t('card.unavailable_refresh') : this.t('card.unavailable_reload')) : this.t('card.loading')})); return; }
    const visible = filterPresets(this.data.presets, this.config.filter, this.runtime, this.favorites);
    const activeIds = new Set(this.active.filter(s => s.targets.some(id => this.config.targets.entity_id.includes(id))).map(s => s.presetId));
    node.replaceChildren(presetGrid(visible, {t: this.t, display: this.config.display, favorites: this.favorites, activeIds,
      favoritesEnabled: this.config.favorites.enabled, canFavorite: this.favoriteReady && this.storage?.canWrite(this.config.favorites.mode),
      apply: p => this.apply(p), favorite: p => this.toggleFavorite(p),
      renderer: this.config.preset_card, rendererAdapter: this.renderer, hass: this._hass, sceneMode: this.scene.mode,
      warn: message => this.notice('renderer', message)}));
  }
  render() {
    if (!this.config) return;
    const categories = this.data ? availableCategories(this.data, this.config.filter) : [];
    if (this.data && this.runtime.category && !categories.some(c => c.id === this.runtime.category)) this.runtime.category = '';
    const card = el('ha-card');
    const header = el('div', {class: 'toolbar'}, [el('h2', {text: this.config.title || 'Scene Presets'})]);
    if (this.config.display.show_refresh) header.append(button('↻', () => this.refresh(), {'aria-label': this.t('card.refresh'), title: this.t('card.refresh_help'), disabled: !this.provider}));
    card.append(header);
    card.append(el('div', {id: 'notices', role: 'status', 'aria-live': 'polite'}), el('div', {id: 'controls'}));
    const filters = el('div', {class: 'toolbar'});
    if (this.config.display.search) filters.append(el('input', {type: 'search', placeholder: this.t('card.search_placeholder'), 'aria-label': this.t('card.search'), value: this.runtime.search || '', oninput: e => {
      const value = e.target.value; clearTimeout(this.searchTimer); this.searchTimer = setTimeout(() => { this.runtime.search = value; this.renderGrid(); }, 180);
    }}));
    if (this.config.display.category_selector && this.data) {
      const select = el('select', {'aria-label': this.t('common.category'), onchange: e => { this.runtime.category = e.target.value; this.renderGrid(); }}, [el('option', {value: '', text: this.t('card.all_categories')})]);
      for (const category of categories) select.append(el('option', {value: category.id, text: category.name}));
      select.value = this.runtime.category || ''; filters.append(select);
    }
    if (this.config.favorites.enabled && this.config.display.favorites) filters.append(button(`${this.runtime.favorites ? '★' : '☆'} ${this.t('common.favorites')}`, e => {
      this.runtime.favorites = !this.runtime.favorites; e.currentTarget.textContent = `${this.runtime.favorites ? '★' : '☆'} ${this.t('common.favorites')}`; e.currentTarget.setAttribute('aria-pressed', String(this.runtime.favorites)); this.renderGrid();
    }, {'aria-pressed': String(!!this.runtime.favorites)}));
    card.append(filters, el('div', {id: 'presets'}), el('div', {id: 'active'}));
    if (this.config.debug && this.compatibility) card.append(el('details', {}, [el('summary', {text: this.t('common.debug')}), el('pre', {text: JSON.stringify({
      version: VERSION, capabilities: this.compatibility.getCapabilities(), presets: this.data?.presets.length, categories: this.data?.categories.length,
      fingerprint: this.data?.sourceFingerprint.length === 64 ? this.data.sourceFingerprint : 'canonical-content', cache: this.data?.status,
      storage: this.config.favorites.mode, renderer: this.config.preset_card?.type || 'internal', missing: this.data ? missingIds(this.config, this.data, this.t) : [],
    }, null, 2)})]));
    this.shadowRoot.replaceChildren(el('style', {text: styles}), card);
    this.renderNotices(); this.renderControls(); this.renderGrid(); this.renderActive();
  }
}
