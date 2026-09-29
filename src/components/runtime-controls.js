import {localize} from '../localize/localize.js';
import {el, field} from '../utils/dom.js';
export function runtimeControls(scene, controls, capabilities, changed, t = localize(), modeLabel = t('common.mode')) {
  const root = el('div', {class: 'controls'});
  const update = (key, value) => changed({...scene, [key]: value});
  const check = (label, value, callback) => field(label, el('input', {type: 'checkbox', checked: !!value, onchange: e => callback(e.target.checked)}));
  const number = (label, value, min, max, callback, disabled = false) => field(label, el('input', {type: 'number', value, min, max, step: 1, disabled,
    onchange: e => { if (e.target.reportValidity()) callback(Number(e.target.value)); }}));
  const slider = (label, value, min, max, callback, disabled = false) => {
    const output = el('output', {text: value});
    const input = el('input', {type: 'range', value, min, max, step: 1, disabled, 'aria-label': t('common.slider', {label}),
      oninput: e => { output.value = e.target.value; }, onchange: e => callback(Number(e.target.value))});
    return el('label', {}, [el('span', {text: label}), el('span', {class: 'range-control'}, [input, output])]);
  };
  if (controls.mode) root.append(field(modeLabel, el('select', {value: scene.mode, onchange: e => update('mode', e.target.value)}, [
    el('option', {value: 'normal', text: t('common.normal'), selected: scene.mode === 'normal', disabled: !capabilities.normalScenes}),
    el('option', {value: 'dynamic', text: t('common.dynamic'), selected: scene.mode === 'dynamic', disabled: !capabilities.dynamicScenes}),
  ])));
  if (scene.mode === 'normal') {
    for (const [key, label] of [['shuffle',t('common.shuffle')],['smart_shuffle',t('common.smart_shuffle')]]) if (controls[key]) root.append(check(label, scene[key], value => update(key, value)));
    for (const [key, label, min, max] of [['brightness',t('common.brightness'),1,255],['transition',t('common.transition'),0,300]]) {
      if (!controls[key]) continue;
      root.append(check(t('common.override', {label}), scene[key].override, override => update(key, {...scene[key], override})),
        key === 'brightness' && controls.brightness_input === 'slider'
          ? slider(label, scene[key].value, min, max, value => update(key, {...scene[key], value}), !scene[key].override)
          : number(label, scene[key].value, min, max, value => update(key, {...scene[key], value}), !scene[key].override));
    }
  } else {
    if (controls.interval) root.append(number(t('common.interval'), scene.interval, 1, 300, value => update('interval', value)));
    if (controls.transition) root.append(number(t('common.transition'), scene.dynamic_transition, 0, 300, value => update('dynamic_transition', value)));
  }
  return root;
}
