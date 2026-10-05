# Configuration

Examples: [README](../README.md).

| Field | Default | Meaning |
|---|---|---|
| targets.entity_id | required | String or list of light.* / group.* entities |
| title | Scene Presets | Heading |
| filter.mode | exclude | include / exclude |
| filter.categories / presets | [] | Upstream IDs, combined with OR within the filter |
| scene.mode | normal | normal / dynamic |
| scene.shuffle / smart_shuffle | false | Normal mode only, handled upstream |
| scene.brightness | {override:false,value:128} | 1–255; sent only when overridden |
| scene.transition (normal) | {override:false,value:1} | 0–300 whole seconds |
| scene.dynamic_transition | 60 | Dynamic mode; 0–300 whole seconds |
| scene.interval | 120 | 1–300 whole seconds |
| controls.mode / shuffle / smart_shuffle / brightness / transition / interval | false | Show the corresponding dashboard control |
| controls.brightness_input | number | number / slider; used by the brightness dashboard control |
| remember.controls | false | Optional Home Assistant user storage |
| storage_key | empty | Required with remember.controls; stable card identifier |
| favorites.enabled | false | Enable favorites |
| favorites.mode | user | user / global; only administrators can write global favorites |
| favorites.namespace | default | Favorites scope shared across cards |
| display.columns | 3 | 1–12 |
| display.show_title | true | Card heading |
| display.show_name | true | Names |
| display.show_category | false | Category names on tiles |
| display.center_titles | false | Center scene titles in the built-in renderer |
| display.group_by_category | false | Divide visible presets into sections with category headings |
| display.show_refresh | true | Show the button for reloading preset data and the optional dynamic status |
| display.search | false | Name/category search with a 180 ms debounce |
| display.category_selector | false | Runtime category selection |
| display.favorites | true | Icons and filter when favorites are enabled |
| display.active_scene | true | Show running dynamic scenes above the controls, with a Stop button for each scene, and highlight their presets |
| preset_card.type | internal | internal / custom:button-card / another child card |
| preset_card.template | empty | Template interpreted by the renderer |
| debug | false | Capabilities, cache, item count, renderer and missing IDs |

Runtime values do not modify the dashboard YAML. `scene.mode` is the default mode selected in the visual editor. When `remember.controls` and the runtime mode control are enabled, a stored valid mode takes priority. When the runtime mode control is disabled, the configured default mode is always used. Other stored control values replace their configured scene defaults when the card loads. A new `storage_key` starts with the configured defaults. The editor preserves unknown fields, including `preset_card.custom_property_xyz`.

`scene.transition` is always the normal-mode override object. `scene.dynamic_transition` is always the transition value used by dynamic mode, so switching modes in the editor preserves both settings independently.

When `override:false`, the service parameter is omitted completely. Dynamic mode sends only the preset, targets, interval and transition. Hidden normal-mode overrides and shuffle controls do not apply in dynamic mode.

Global storage uses `frontend/*_system_data`; user and runtime storage use `frontend/*_user_data`. If an API is unavailable, the additional feature is shown as unavailable. No tokens or user-selectable user IDs are stored. Debug output does not expose authentication data. Preset names are rendered as text, not HTML.

Category selection: only categories containing at least one preset after the include/exclude filter are offered on the dashboard. This selection is built before runtime search and favorite filtering. If a data update removes the currently selected category, the selection resets to "All categories."

Language: the card and editor use the Home Assistant user's language. English is the default and fallback; German, Dutch and French are included. Regional variants use their base language. There is no separate `language` option. Preset names, category names and custom titles remain unchanged.

## Display options

Under **4 · Appearance** in the editor, scene titles can be centered, scenes can be divided by category headings, the refresh icon can be hidden, and the active-scene panel can be shown or hidden:

```yaml
display:
  center_titles: true
  group_by_category: true
  show_refresh: false
  active_scene: false
```

The defaults remain left-aligned titles, a single combined overview and a visible refresh icon. Centering applies to the built-in tile renderer; external custom cards determine text alignment through their own configuration. Category sections work with both renderer types. Only categories with currently visible presets are displayed, including after applying search and favorite filters. The existing `show_category` option additionally shows the category name on each tile.

The active-scene panel appears directly below the card header by default. It shows running dynamic scenes reported by the integration, including scenes started elsewhere, and offers a Stop button for each one. The panel is a dated snapshot. Normal scenes are one-time actions and are not reported as running by the integration.

↻ reloads the preset collection, checks its fingerprint and, when `display.active_scene:true`, retrieves the current dynamic status. It does not apply a scene. With `show_refresh:false`, only the button is hidden; the initial load and status updates following this card's own scene actions remain enabled. External scene changes then become visible the next time the card loads.
