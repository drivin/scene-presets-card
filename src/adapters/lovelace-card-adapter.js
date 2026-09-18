import {LocalizedError} from '../localize/localize.js';
/**
 * EXTERNAL API
 * Project: Home Assistant Lovelace
 * Purpose: Child cards, native editor selector, custom card registration.
 * Upstream interface: window.loadCardHelpers().createCardElement(config),
 * customElements registry, element.hass/setConfig, config-changed; ha-selector.
 * Breaking-change risks: helper loading, internal selector contract, custom card lifecycle.
 * Verified against: frontend/dev create-card-element.ts and custom-card docs, 2026-09-18.
 */
export class LovelaceCardAdapter {
  capabilities() { return {lovelaceCardHelpers: typeof globalThis.loadCardHelpers === 'function', buttonCard: !!globalThis.customElements?.get('button-card')}; }
  async create(config, hass) {
    if (!this.capabilities().lovelaceCardHelpers) throw new LocalizedError('error.helpers');
    if (config.type?.startsWith('custom:') && !customElements.get(config.type.slice(7))) throw new LocalizedError('error.renderer', {type: config.type});
    const helpers = await globalThis.loadCardHelpers();
    const card = helpers.createCardElement(config);
    if (card.localName === 'hui-error-card') throw new LocalizedError('error.child_config');
    card.hass = hass; card.inert = true; card.setAttribute('aria-hidden', 'true');
    return card;
  }
  update(card, hass) { card.hass = hass; }
  async ensureEditorComponents() {
    if (customElements.get('ha-selector')) return;
    if (!this.capabilities().lovelaceCardHelpers) throw new LocalizedError('error.selector_helpers');
    const helpers = await globalThis.loadCardHelpers();
    const card = helpers.createCardElement({type: 'entities', entities: []});
    await customElements.whenDefined('hui-entities-card');
    await customElements.get('hui-entities-card').getConfigElement();
    if (!customElements.get('ha-selector')) throw new LocalizedError('error.selector');
  }
  entitySelector(hass, value, onChange) {
    const selector = document.createElement('ha-selector');
    selector.hass = hass; selector.selector = {entity: {domain: ['light','group'], multiple: true}};
    selector.value = value;
    selector.addEventListener('value-changed', event => { event.stopPropagation(); onChange(event.detail.value); });
    return selector;
  }
  register(name, constructor) { if (!customElements.get(name)) customElements.define(name, constructor); }
  publishCard() {
    globalThis.customCards = globalThis.customCards || [];
    if (!globalThis.customCards.some(c => c.type === 'scene-presets-card')) globalThis.customCards.push({type: 'scene-presets-card', name: 'Scene Presets', description: 'Dynamic scene presets with shared lights and settings', preview: true});
  }
}
