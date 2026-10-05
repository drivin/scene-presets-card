import {LocalizedError} from '../localize/localize.js';
import {ids, numberIn} from '../utils/validation.js';
export function normalizeScene(scene = {}) {
  const mode = scene.mode ?? 'normal';
  if (!['normal', 'dynamic'].includes(mode)) throw new LocalizedError('error.scene_mode');
  const brightness = {override: false, value: 128, ...scene.brightness};
  if (scene.transition !== undefined && (typeof scene.transition !== 'object' || scene.transition === null || Array.isArray(scene.transition))) throw new LocalizedError('error.scene_transition');
  const transition = {override: false, value: 1, ...scene.transition};
  const dynamicTransition = scene.dynamic_transition ?? 60;
  for (const key of ['shuffle', 'smart_shuffle']) if (scene[key] !== undefined && typeof scene[key] !== 'boolean') throw new LocalizedError('error.boolean', {name: key});
  for (const [key, item] of [['brightness', brightness], ['transition', transition]]) {
    if (typeof item.override !== 'boolean') throw new LocalizedError('error.boolean', {name: `${key}.override`});
  }
  numberIn(brightness.value, 1, 255, 'brightness.value');
  numberIn(transition.value, 0, 300, 'transition.value');
  numberIn(dynamicTransition, 0, 300, 'dynamic transition');
  numberIn(scene.interval ?? 120, 1, 300, 'interval');
  return {mode, shuffle: scene.shuffle ?? false, smart_shuffle: scene.smart_shuffle ?? false,
    brightness, transition, dynamic_transition: dynamicTransition, interval: scene.interval ?? 120};
}
export function normalizeConfig(input) {
  if (!input || typeof input !== 'object') throw new LocalizedError('error.config');
  const entityIds = ids(typeof input.targets?.entity_id === 'string' ? [input.targets.entity_id] : input.targets?.entity_id, 'targets.entity_id');
  if (!entityIds.length || entityIds.some(id => !/^(light|group)\.[a-z0-9_]+$/.test(id))) throw new LocalizedError('error.targets');
  if (Object.keys(input.targets).some(k => k !== 'entity_id')) throw new LocalizedError('error.target_type');
  const filter = {mode: 'exclude', categories: [], presets: [], ...input.filter};
  if (!['include','exclude'].includes(filter.mode) || 'include' in filter || 'exclude' in filter) throw new LocalizedError('error.filter');
  filter.categories = ids(filter.categories, 'filter.categories'); filter.presets = ids(filter.presets, 'filter.presets');
  const favorites = {enabled: false, mode: 'user', namespace: 'default', ...input.favorites};
  if (typeof favorites.enabled !== 'boolean') throw new LocalizedError('error.boolean', {name: 'favorites.enabled'});
  if (!['user','global'].includes(favorites.mode)) throw new LocalizedError('error.favorites_mode');
  if (typeof favorites.namespace !== 'string' || !favorites.namespace.trim()) throw new LocalizedError('error.namespace');
  const remember = {controls: false, ...input.remember};
  if (typeof remember.controls !== 'boolean') throw new LocalizedError('error.boolean', {name: 'remember.controls'});
  if (remember.controls && (typeof input.storage_key !== 'string' || !input.storage_key.trim())) throw new LocalizedError('error.storage_key');
  const controls = {mode: false, shuffle: false, smart_shuffle: false, brightness: false, transition: false, interval: false, brightness_input: 'number', ...input.controls};
  for (const key of ['mode', 'shuffle', 'smart_shuffle', 'brightness', 'transition', 'interval']) {
    if (typeof controls[key] !== 'boolean') throw new LocalizedError('error.boolean', {name: `controls.${key}`});
  }
  if (!['number','slider'].includes(controls.brightness_input)) throw new LocalizedError('error.brightness_input');
  const display = {columns: 3, show_title: true, show_name: true, show_category: false, center_titles: false, group_by_category: false, show_refresh: true, search: false, category_selector: false, favorites: true, active_scene: true, ...input.display};
  for (const key of ['show_title', 'show_name', 'show_category', 'center_titles', 'group_by_category', 'show_refresh', 'search', 'category_selector', 'favorites', 'active_scene']) {
    if (typeof display[key] !== 'boolean') throw new LocalizedError('error.boolean', {name: `display.${key}`});
  }
  numberIn(display.columns, 1, 12, 'display.columns');
  const debug = input.debug ?? false;
  if (typeof debug !== 'boolean') throw new LocalizedError('error.boolean', {name: 'debug'});
  return {...input, targets: {entity_id: entityIds}, filter, scene: normalizeScene(input.scene), controls, favorites, remember, display, debug};
}
