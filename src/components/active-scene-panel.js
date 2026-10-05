import {localize} from '../localize/localize.js';
import {haLanguage} from '../adapters/ha-localization-adapter.js';
import {el, button} from '../utils/dom.js';
export function activeScenePanel(scenes, presets, hass, timestamp, stop, canStop, showRefresh = true, t = localize(hass), pendingStops = new Set()) {
  const root = el('section');
  root.append(el('h3', {text: t('status.title')}), el('p', {class: 'notice', text: timestamp ? t('status.snapshot', {time: new Date(timestamp).toLocaleTimeString(haLanguage(hass).replaceAll('_', '-'))}) + (showRefresh ? t('status.refresh') : '') : t('status.unavailable')}));
  if (timestamp && !scenes.length) root.append(el('p', {text: t('status.empty')}));
  const tiles = el('div', {class: 'active-scenes'});
  for (const scene of scenes) {
    const preset = presets.find(p => p.id === scene.presetId);
    const name = preset?.name ?? scene.presetId;
    const tile = button('', () => stop(scene.id), {class: 'active-scene-tile', disabled: !canStop || pendingStops.has(scene.id), 'aria-label': t('status.stop_scene', {name})});
    if (preset?.picture) {
      const img = el('img', {src: preset.picture, alt: '', loading: 'lazy'});
      img.addEventListener('error', () => img.replaceWith(el('span', {class: 'active-scene-placeholder'})), {once: true});
      tile.append(img);
    } else tile.append(el('span', {class: 'active-scene-placeholder'}));
    tile.append(el('span', {class: 'active-scene-meta', text: t('status.parameters', {interval: scene.interval, transition: scene.transition})}),
      el('span', {class: 'active-scene-stop', text: `■ ${t('common.stop')}`}),
      el('span', {class: 'active-scene-name', text: name}));
    const details = el('details', {class: 'active-scene-targets'}, [el('summary', {text: t('status.targets')})]);
    for (const id of scene.targets) details.append(el('div', {text: `${hass.states?.[id]?.state === 'on' ? '●' : '○'} ${hass.states?.[id]?.attributes?.friendly_name ?? id}`}));
    tiles.append(el('div', {class: 'active-scene-card'}, [tile, details]));
  }
  root.append(tiles);
  return root;
}
