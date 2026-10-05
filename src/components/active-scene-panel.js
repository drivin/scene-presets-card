import {localize} from '../localize/localize.js';
import {haLanguage} from '../adapters/ha-localization-adapter.js';
import {el, button} from '../utils/dom.js';
export function activeScenePanel(scenes, presets, hass, timestamp, stop, canStop, showRefresh = true, t = localize(hass)) {
  const root = el('section');
  root.append(el('h3', {text: t('status.title')}), el('p', {class: 'notice', text: timestamp ? t('status.snapshot', {time: new Date(timestamp).toLocaleTimeString(haLanguage(hass).replaceAll('_', '-'))}) + (showRefresh ? t('status.refresh') : '') : t('status.unavailable')}));
  if (timestamp && !scenes.length) root.append(el('p', {text: t('status.empty')}));
  for (const scene of scenes) {
    const name = presets.find(p => p.id === scene.presetId)?.name ?? scene.presetId;
    const details = el('details', {}, [el('summary', {text: name})]);
    for (const id of scene.targets) details.append(el('div', {text: `${hass.states?.[id]?.state === 'on' ? '●' : '○'} ${hass.states?.[id]?.attributes?.friendly_name ?? id}`}));
    details.append(el('p', {text: t('status.parameters', {interval: scene.interval, transition: scene.transition})}));
    root.append(el('div', {class: 'active-scene'}, [details, button(t('common.stop'), () => stop(scene.id), {disabled: !canStop, 'aria-label': t('status.stop_scene', {name})})]));
  }
  return root;
}
