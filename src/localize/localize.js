import en from './en.json' with {type: 'json'};
import de from './de.json' with {type: 'json'};
import nl from './nl.json' with {type: 'json'};
import fr from './fr.json' with {type: 'json'};
import {haLanguage} from '../adapters/ha-localization-adapter.js';

export const languages = {en, de, nl, fr};
export function resolveLanguage(language) {
  const normalized = typeof language === 'string' ? language.toLowerCase().replaceAll('_', '-') : 'en';
  return Object.hasOwn(languages, normalized) ? normalized : Object.hasOwn(languages, normalized.split('-')[0]) ? normalized.split('-')[0] : 'en';
}
export function message(key, values = {}) { return {translationKey: key, values}; }
export function localize(hass) {
  const dictionary = languages[resolveLanguage(haLanguage(hass))];
  const render = value => {
    if (value && typeof value.translationKey === 'string') return t(value.translationKey, value.values);
    if (value && typeof value.message === 'string') return value.message;
    return value == null ? t('error.unknown') : String(value);
  };
  const t = (key, values = {}) => {
    const template = Object.hasOwn(dictionary, key) ? dictionary[key] : Object.hasOwn(en, key) ? en[key] : key;
    return template.replace(/\{(\w+)\}/g, (match, name) => Object.hasOwn(values, name) ? render(values[name]) : match);
  };
  t.render = render;
  return t;
}
export class LocalizedError extends Error {
  constructor(key, values = {}) {
    super(localize()(key, values));
    this.name = 'LocalizedError'; this.translationKey = key; this.values = values;
  }
}
