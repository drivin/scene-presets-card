/**
 * EXTERNAL API
 * Project: Home Assistant frontend
 * Purpose: Follow the language selected in the user's Home Assistant profile.
 * Upstream interface: hass.language is the effective UI language;
 * hass.locale.language is retained as a compatibility fallback.
 * Custom-card strings use bundled dictionaries, not HA core's hass.localize keys.
 * Breaking-change risks: locale shape and custom-card hass lifecycle.
 * Verified against: frontend/src/types.ts, custom-card-helpers HomeAssistant,
 * custom-cards/boilerplate-card/src/localize/localize.ts, 2026-09-18.
 */
export function haLanguage(hass) { return hass?.language || hass?.locale?.language || 'en'; }
