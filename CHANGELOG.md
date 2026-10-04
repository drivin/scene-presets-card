# Changelog

## [Unreleased]

### Fixed
- Configuration validation now rejects non-boolean values for all documented boolean options instead of treating strings such as `"false"` as enabled.
- The configuration reference now includes `controls.brightness_input` and `display.show_title`, and preset validation errors are fully localized.

## 1.2.0 — 2026-09-29

### Added
- A localized **Default mode** field in the visual editor for selecting the card's initial normal or dynamic scene mode.
- Card-picker suggestions for supported `light.*` entities on Home Assistant 2026.6 and newer.
- Localized the card, editor, accessible labels, and custom error messages, with English as the default and fallback plus German, Dutch, and French.
- Added automatic language selection from the Home Assistant profile, including regional variants and language changes without losing editor state.
- Bundled translations into the single-file distribution while keeping the shared cache language-independent.
- Added an English GitHub README and localization guide, an explicitly marked placeholder Buy Me a Coffee link, and the Apache 2.0 license text in the JavaScript bundle.

### Changed
- Normal and dynamic transition settings now use the unambiguous `scene.transition` and `scene.dynamic_transition` fields respectively.

### Fixed
- Remembered runtime state no longer overrides the configured default mode when the dashboard mode control is disabled.
- The card picker stub now follows the custom-card contract and leaves the `type` field to Home Assistant.
- The visual editor now provides a native entity multi-select when Home Assistant's selector cannot be loaded.

## 1.1.4 — 2026-09-18

- Added optional centered scene titles in the built-in renderer.
- Added category headings and separate grids for currently visible presets without empty sections.
- Made the refresh icon optional and added matching error and status guidance.
- Exposed all three options in the visual editor under Appearance.
- Passed 15 core checks and the extended browser tests.

## 1.1.3 — 2026-09-18

- Removed information icons and the service-call preview, including hold and context-menu handlers.
- Expanded the name display into the space previously occupied by the information icon.

## 1.1.2 — 2026-09-18

- Switched distribution to a single JavaScript file so version changes update the card, editor, and all supporting modules together.
- Added a visible version number to the editor and debug panel.
- Reproduced the warm HTTP-cache failure and verified the corrected behavior in Chromium.
- Kept the modular source under `src/` with a reproducible esbuild build.

## 1.1.1 — 2026-09-18

- Added specific integration-activation guidance for HTTP 404 responses and a retry action in the editor.
- Limited category selection to categories containing presets allowed by the card filter and reset stale runtime selections.
- Added separate collapsible editor sections with clearer field names and help text while preserving searches and expanded sections.
- Documented the language scope at the time: German only, without automatic localization.
- Passed 15 core checks and the extended Chromium browser tests.

## 1.1.0 — 2026-09-18

- Added automatic preset, category, and image discovery, including custom presets.
- Added modular adapters, a shared cache, and fingerprint validation.
- Added normal and dynamic modes, shared targets, overrides, Shuffle, and Smart Shuffle.
- Added include/exclude filtering, search, categories, and a visual editor.
- Added the built-in renderer and optional Lovelace or Button Card renderers with fallback behavior.
- Added per-user and global favorites with namespaces, Home Assistant permission handling, and live synchronization when available.
- Added runtime persistence, dynamic-scene snapshots, stop controls, and service previews.
- Added external contract documentation and automated tests.
