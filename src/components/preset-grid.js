import {localize} from '../localize/localize.js';
import {el} from '../utils/dom.js';
import {presetTile} from './preset-tile.js';

function tileGrid(presets, context) {
  const grid = el('div', {class: 'grid'});
  grid.style.setProperty('--columns', context.display.columns);
  grid.style.setProperty('--preset-name-align', context.display.center_titles ? 'center' : 'left');
  for (const preset of presets) grid.append(presetTile({...preset, favorite: context.favorites.includes(preset.id)}, {...context,
    active: context.activeIds.has(preset.id)}));
  if (!presets.length) grid.append(el('p', {text: context.t('card.empty')}));
  return grid;
}

export function presetGrid(presets, context) {
  context = {...context, t: context.t || localize(context.hass)};
  if (!context.display.group_by_category || !presets.length) return tileGrid(presets, context);
  // Only visible presets are grouped, so config and runtime filters cannot leave empty headings.
  const groups = new Map();
  for (const preset of presets) {
    const id = preset.categoryId || '';
    if (!groups.has(id)) groups.set(id, {name: preset.categoryName || context.t('common.uncategorized'), presets: []});
    groups.get(id).presets.push(preset);
  }
  const root = el('div', {class: 'preset-groups'});
  for (const {name, presets: children} of groups.values()) {
    root.append(el('section', {class: 'preset-group', 'aria-label': name}, [
      el('h3', {class: 'category-heading', text: name}), tileGrid(children, context),
    ]));
  }
  return root;
}
