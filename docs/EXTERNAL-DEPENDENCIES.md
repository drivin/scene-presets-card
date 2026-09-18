# Verified external interfaces

Analysis before implementation: 2026-09-18. Scene Presets 2.4.0,
commit `b53280c76f6a94ea68f313c53865c3922d40b2d7`.
Sources: [Integration](https://github.com/Hypfer/hass-scene_presets/tree/b53280c76f6a94ea68f313c53865c3922d40b2d7/custom_components/scene_presets),
[Home Assistant Storage](https://github.com/home-assistant/core/blob/dev/homeassistant/components/frontend/storage.py),
[Home Assistant Frontend](https://github.com/home-assistant/frontend/blob/dev/src/data/frontend.ts),
[Custom Cards](https://developers.home-assistant.io/docs/frontend/custom-ui/custom-card/),
[button-card](https://github.com/custom-cards/button-card/blob/master/src/button-card.ts).
Home Assistant, its frontend and button-card were checked against their development branches on the analysis date;
their optional features are therefore also checked at runtime.

| Dependency | Function | Interface | Breaking-change risk |
|---|---|---|---|
| scene_presets | Presets/categories | GET /assets/scene_presets/scene_presets.json | high |
| scene_presets | Images | /assets/scene_presets/{img} | high |
| scene_presets | Normal | scene_presets.apply_preset | high |
| scene_presets | Dynamic | scene_presets.start_dynamic_scene | high |
| scene_presets | Status | WS scene_presets/get_dynamic_scenes | high |
| scene_presets | Stop | scene_presets.stop_dynamic_scene | high |
| Home Assistant | User storage | frontend/{get,set,subscribe}_user_data | medium |
| Home Assistant | Global storage | frontend/{get,set,subscribe}_system_data | medium |
| Lovelace | Child cards | loadCardHelpers().createCardElement, setConfig, hass | medium |
| Lovelace | Editor | config-changed; ha-selector | medium |
| button-card | Renderer | variables, template, entity_picture, action:none | medium |

## Presets and custom presets

The endpoint returns `{categories:[{id,name}], presets:[{id,name,categoryId,img,bri,lights}]}`.
IDs are strings. `img` is an optional relative filename; `bri` is 0–255.
Custom data from `userdata/custom/presets.json` is appended by `file_utils.py`
and marked with `custom:true`. Images are stored in `userdata/custom/assets` but
use the same HTTP path. The integration loads these files during import, so Home
Assistant must restart after file changes. The card can detect only changes that
the integration has already published. There are no per-preset requests and no
separate database.

## Exact calls

Normal: `hass.callService('scene_presets','apply_preset', {preset_id,
targets:{entity_id:['light.example']}, shuffle:true, smart_shuffle:true})`.
Optional `brightness` (0–255) and `transition` (whole seconds, 0–300).
Without an override, the field is omitted. Upstream defaults to one second.
Note: upstream version 2.4.0 treats `brightness=0` as a missing override.
The card therefore permits explicit overrides only from 1 to 255.

Dynamic: `hass.callService('scene_presets','start_dynamic_scene', {preset_id,
targets:{entity_id:['light.example']}, interval:120, transition:60})`.
There are no shuffle parameters: the integration handles shuffle and Smart Shuffle.
The card limits `interval` to 1–300 seconds to prevent a loop without a pause.
Stop: `hass.callService('scene_presets','stop_dynamic_scene',{id:sceneUuid})`.
Status: `hass.callWS({type:'scene_presets/get_dynamic_scenes'})` returns
`{dynamic_scenes:[{id,running,interval,parameters:{preset_id,light_entity_ids,
brightness,transition,shuffle}}]}`. No status subscription has been verified.
Status refreshes on load, after the card's own actions and through the refresh button.
The display is an explicitly dated snapshot, not an inferred live state.

Targets are passed in the service data object rather than as a Home Assistant service
target. Entity lists, including light groups, are resolved upstream. The card initially
supports only `entity_id`. New dynamic scenes cause upstream to stop overlapping
scenes. The first iteration turns lights on with a 0.5-second transition; subsequent
iterations skip lights that are off, and the scene ends when all lights are off.
Normal scenes turn lights on.

## Storage and permissions

The upstream UI stores favorites and settings only in `localStorage`. The card uses
its own Home Assistant frontend namespace and does not import those values.
Get payload: `{type:'frontend/get_user_data',key:'scene_presets_card:...'}`;
response: `{value:...}`. Set additionally includes `value`. System storage is
analogous. User storage belongs to the authenticated user; no arbitrary user ID can
be supplied. Global storage is readable by authenticated users, while only
administrators can write it. Subscribe uses the same key and returns `{value}`
events; if the command is unavailable, data refreshes on load. There is no silent
`localStorage` fallback. Write conflicts between browsers use last-write-wins
semantics because upstream provides no compare-and-swap operation.

## Renderer

Child cards are created exclusively in the adapter. button-card receives
`variables.preset` and `variables.card.sceneMode`. The parent card owns the
interactions; child cards are inert and all action fields are disabled. The native
button-card template system remains responsible for templating. If a renderer is
missing or cannot be created, the built-in renderer appears with a clear notice.
Generic child cards receive the same metadata; their appearance depends on their
own configuration contract, and the card does not invent a template language.

## Phase verification

Phase 1 completed: sources, data format, service payloads, targets, status, stop,
custom presets, persistence and permissions were checked before production code
was written. Unavailable optional APIs are treated as capability failures.

Also checked against Home Assistant Core 2026.9.3 `frontend/storage.py`: all six
storage commands are present, and system writes require administrator privileges.
Native editor components are loaded on demand through
`hui-entities-card.getConfigElement()` (frontend/dev:
`hui-entities-card` → `hui-entities-card-editor` → `ha-form` → `ha-selector`;
verified 2026-09-18).

Build dependency since 1.1.2: esbuild 0.25.5, for development only;
`build({bundle:true, format:"esm", write:false, metafile:true})`. The build requires
exactly one output file with no external JavaScript imports.
API: https://esbuild.github.io/api/#bundle. There is no additional browser runtime
dependency.

## Home Assistant language (1.2.0)

Adapter: `ha-localization-adapter.js`; contract: `hass.locale.language`, compatible
with `hass.language`. The Lovelace frontend passes a changed language through the
`hass` setter. The custom card's own text uses bundled JSON catalogs with an English
fallback; `hass.localize` does not load a custom card's translation files. The native
entity selector continues to receive `hass`. Verified on 2026-09-18:
[HomeAssistant interface](https://custom-cards.github.io/custom-card-helpers/interfaces/HomeAssistant.html),
[community template](https://github.com/custom-cards/boilerplate-card/blob/master/src/localize/localize.ts).
Breaking-change risk: the shape of locale data and the `hass` lifecycle.
