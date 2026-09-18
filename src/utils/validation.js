import {LocalizedError, localize} from '../localize/localize.js';
export function numberIn(value, min, max, name) {
  if (!Number.isInteger(value) || value < min || value > max) throw new LocalizedError('error.number', {name, min, max});
  return value;
}
export function ids(value, name) {
  if (!Array.isArray(value) || value.some(x => typeof x !== 'string' || !x)) throw new LocalizedError('error.ids', {name});
  return [...new Set(value)];
}
export function missingIds(config, data, t = localize()) {
  return [
    ...(config.filter.presets || []).filter(id => !data.presets.some(p => p.id === id)).map(id => t('error.missing_preset', {id})),
    ...(config.filter.categories || []).filter(id => !data.categories.some(c => c.id === id)).map(id => t('error.missing_category', {id})),
  ];
}
export function filterPresets(presets, filter, runtime = {}, favorites = []) {
  const selected = p => filter.categories.includes(p.categoryId) || filter.presets.includes(p.id);
  const query = (runtime.search || '').trim().toLocaleLowerCase();
  return presets.filter(p => (filter.mode === 'include' ? selected(p) : !selected(p)))
    .filter(p => !runtime.category || p.categoryId === runtime.category)
    .filter(p => !runtime.favorites || favorites.includes(p.id))
    .filter(p => !query || `${p.name} ${p.categoryName}`.toLocaleLowerCase().includes(query));
}

/** Categories with children after the card's include/exclude filter, before runtime filters. */
export function availableCategories(data, filter) {
  const populated = new Set(filterPresets(data.presets, filter).map(preset => preset.categoryId));
  return data.categories.filter(category => populated.has(category.id));
}
