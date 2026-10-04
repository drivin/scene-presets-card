import {LocalizedError, message} from '../localize/localize.js';
import {assertRecord} from '../models/preset.js';
import {normalizeScene} from '../models/card-config.js';
/**
 * EXTERNAL API
 * Project: Hypfer/hass-scene_presets
 * Purpose: Metadata, images, normal/dynamic actions and authoritative status.
 * Upstream interface: GET /assets/scene_presets/scene_presets.json;
 * scene_presets.apply_preset/start_dynamic_scene/stop_dynamic_scene;
 * WS scene_presets/get_dynamic_scenes. Exact payloads: docs/EXTERNAL-DEPENDENCIES.md.
 * Breaking-change risks: response fields, asset routing, service schemas.
 * Verified against: 2.4.0, b53280c76f6a94ea68f313c53865c3922d40b2d7, 2026-09-18.
 */
export class ScenePresetsAdapter {
  constructor(hass, fetcher = (...args) => globalThis.fetch(...args)) { this.hass = hass; this.fetcher = fetcher; this.discovery = false; this.status = false; }
  get source() { return '/assets/scene_presets/scene_presets.json'; }
  getCapabilities() {
    const services = this.hass?.services?.scene_presets || {};
    return {presetDiscovery: this.discovery, normalScenes: !!services.apply_preset,
      dynamicScenes: !!services.start_dynamic_scene, dynamicSceneStatus: this.status,
      dynamicSceneStop: !!services.stop_dynamic_scene};
  }
  async loadPresets() {
    const response = await this.fetcher(this.source, {cache: 'no-cache', credentials: 'same-origin'});
    if (!response.ok) {
      this.discovery = false;
      const hint = message(response.status === 404 ? 'error.activation' : 'error.integration_status');
      throw new LocalizedError('error.endpoint', {status: response.status, hint});
    }
    const data = await response.json();
    if (!Array.isArray(data.presets) || !Array.isArray(data.categories)) throw new LocalizedError('error.endpoint_format');
    for (const [kind, values] of [['preset', data.presets], ['category', data.categories]]) {
      const seen = new Set();
      for (const value of values) {
        assertRecord(value, kind);
        if (seen.has(value.id)) throw new LocalizedError('error.duplicate', {kind: kind === 'category' ? message('common.category') : message('common.preset'), id: value.id});
        seen.add(value.id);
      }
    }
    this.discovery = true;
    return data;
  }
  normalizeCategory(raw) { assertRecord(raw, 'category'); return {id: raw.id, name: raw.name}; }
  normalizePreset(raw, categories) {
    assertRecord(raw, 'preset');
    const safeImage = typeof raw.img === 'string' && !raw.img.split('/').some(s => s === '..') && !/[:\\?#]/.test(raw.img) && !raw.img.startsWith('/');
    return {id: raw.id, name: raw.name, categoryId: raw.categoryId ?? '',
      categoryName: categories.get(raw.categoryId)?.name ?? '',
      picture: safeImage ? `/assets/scene_presets/${raw.img.split('/').map(encodeURIComponent).join('/')}` : null,
      brightness: raw.bri, raw};
  }
  buildCall(presetId, targets, input) {
    if (!presetId || !targets?.entity_id?.length) throw new LocalizedError('error.preset_targets');
    const scene = normalizeScene(input);
    const data = {preset_id: presetId, targets: {entity_id: [...targets.entity_id]}};
    const dynamic = scene.mode === 'dynamic';
    if (dynamic) { data.interval = scene.interval; data.transition = scene.dynamic_transition; }
    else {
      data.shuffle = scene.shuffle; data.smart_shuffle = scene.smart_shuffle;
      if (scene.brightness.override) data.brightness = scene.brightness.value;
      if (scene.transition.override) data.transition = scene.transition.value;
    }
    return {domain: 'scene_presets', service: dynamic ? 'start_dynamic_scene' : 'apply_preset', data};
  }
  async execute(call) {
    if (!this.hass?.services?.scene_presets?.[call.service]) throw new LocalizedError('error.service', {service: call.service});
    return this.hass.callService(call.domain, call.service, call.data);
  }
  applyPreset(id, targets, scene) { return this.execute(this.buildCall(id, targets, {...scene, mode: 'normal'})); }
  startDynamicScene(id, targets, scene) { return this.execute(this.buildCall(id, targets, {...scene, mode: 'dynamic'})); }
  stopDynamicScene(id) { return this.execute({domain: 'scene_presets', service: 'stop_dynamic_scene', data: {id}}); }
  async getActiveDynamicScenes() {
    try {
      const result = await this.hass.callWS({type: 'scene_presets/get_dynamic_scenes'});
      if (!Array.isArray(result?.dynamic_scenes)) throw new LocalizedError('error.status_format');
      const scenes = result.dynamic_scenes.map(s => {
        if (typeof s.id !== 'string' || typeof s.parameters?.preset_id !== 'string' || !Array.isArray(s.parameters?.light_entity_ids)) throw new LocalizedError('error.dynamic_scene');
        return {id: s.id, presetId: s.parameters.preset_id, targets: s.parameters.light_entity_ids,
          interval: s.interval, transition: s.parameters.transition, running: s.running};
      });
      this.status = true; return scenes;
    } catch (error) { this.status = false; throw error; }
  }
}
