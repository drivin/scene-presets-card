/**
 * EXTERNAL API
 * Project: custom-cards/button-card
 * Purpose: Optional presentation, without service orchestration.
 * Upstream interface: template, variables.preset, variables.card, entity_picture,
 * show_entity_picture, action:none; rendered through Lovelace helpers.
 * Breaking-change risks: variable evaluation, template merging, action fields.
 * Verified against: button-card/master src/button-card.ts, 2026-09-18.
 */
export function rendererConfig(config, preset, sceneMode) {
  const out = {...config, name: preset.name, entity_picture: preset.picture,
    show_entity_picture: !!preset.picture, variables: {...config.variables, preset, card: {sceneMode}}};
  for (const key of ['tap_action','hold_action','double_tap_action','press_action','release_action','icon_tap_action','icon_hold_action','icon_double_tap_action','icon_press_action','icon_release_action']) out[key] = {action: 'none'};
  return out;
}
