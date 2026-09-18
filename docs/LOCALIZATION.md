# Localization

Scene Presets Card uses the customary custom-card pattern: bundled JSON dictionaries and a `localize` helper. The current Home Assistant language comes from `hass.locale.language`, with `hass.language` as a compatibility fallback. An absent or unsupported language falls back to English. Regional variants resolve to their base language.

The language is read through `src/adapters/ha-localization-adapter.js`. Each card/editor has its own translator; there is no global selected language and no separate localStorage preference. Updating `hass` with a different language renders the existing state again without loading presets or executing scene actions.

Home Assistant's `hass.localize` resolves **Home Assistant core strings**. It does not automatically discover translation files in a custom card's `www` directory. This card's own messages therefore use `src/localize/en.json`, `de.json`, `nl.json` and `fr.json`, compiled into the single release file. The native entity selector continues to receive `hass` and uses Home Assistant's own translations.

References checked on 2026-09-18:

- [Home Assistant custom card lifecycle](https://developers.home-assistant.io/docs/frontend/custom-ui/custom-card/)
- [HomeAssistant interface: locale, language and localize](https://custom-cards.github.io/custom-card-helpers/interfaces/HomeAssistant.html)
- [Community custom-card localization example](https://github.com/custom-cards/boilerplate-card/blob/master/src/localize/localize.ts)
- [Home Assistant core localization](https://github.com/home-assistant/frontend/blob/dev/src/common/translations/localize.ts)

## Adding or updating a translation

1. Copy `src/localize/en.json` to the desired language code.
2. Translate every value, retaining keys and named placeholders such as `{name}` and `{count}`. Do not translate YAML property names or service identifiers inside messages.
3. Import the dictionary in `src/localize/localize.js` and register it in `languages`.
4. Run `npm test`, `npm run build`, `npm run test:browser` and `npm run test:cache`.
5. Document the language in the README and test it in the editor and card.

Messages use named interpolation and are inserted as text, never HTML. All messages fall back per key to English. A missing English key displays its key for diagnosis. The catalogs use count labels that work without singular/plural branching; the helper does not implement ICU plural rules.

Own adapter/validation errors carry a stable translation key and values. Translation happens when they are displayed, so cached data and existing errors can be shared across languages. Upstream error details and user/preset/category names are not translated. The card picker registration uses an English description because registration runs before a `hass` instance is provided.

## Language selection

English is the default. German, Dutch and French are the initial additional translations. The public Home Assistant Analytics pages reviewed did not provide a ranking of UI-language usage. Do not describe this selection as a verified top three.
