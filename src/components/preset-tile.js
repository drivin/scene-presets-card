import {message} from '../localize/localize.js';
import {el, button} from '../utils/dom.js';
import {rendererConfig} from '../adapters/button-card-adapter.js';
export function presetTile(preset, context) {
  const {t, display, apply, favorite, canFavorite, favoritesEnabled, active, renderer, rendererAdapter, hass, sceneMode, warn} = context;
  const root = el('div', {class: `tile${active ? ' active' : ''}`});
  const content = [];
  if (preset.picture) {
    const img = el('img', {src: preset.picture, alt: '', loading: 'lazy'});
    img.addEventListener('error', () => img.replaceWith(el('div', {class: 'placeholder', text: '◈'})), {once: true});
    content.push(img);
  } else content.push(el('div', {class: 'placeholder', text: '◈'}));
  if (display.show_name) content.push(el('span', {class: 'name', text: preset.name}));
  if (display.show_category) content.push(el('span', {class: 'category', text: preset.categoryName || t('common.uncategorized')}));
  const target = button('', () => apply(preset), {class: 'apply', 'aria-label': t('card.apply', {name: preset.name})});
  target.append(...content); root.append(target);
  if (active) root.append(el('span', {class: 'badge', text: '▶', title: t('card.active_badge')}));
  if (favoritesEnabled && display.favorites) root.append(button(preset.favorite ? '★' : '☆', e => { e.stopPropagation(); favorite(preset); },
    {class: 'favorite', disabled: !canFavorite, 'aria-label': t('card.toggle_favorite', {name: preset.name}), 'aria-pressed': String(preset.favorite)}));
  if (renderer?.type && renderer.type !== 'internal') {
    rendererAdapter.create(rendererConfig(renderer, {...preset, raw: undefined, active}, sceneMode), hass).then(child => {
      if (!root.isConnected) return;
      child.classList.add('child'); target.replaceChildren(child); root.childCard = child;
    }).catch(error => warn(message('notice.renderer', {error})));
  }
  return root;
}
