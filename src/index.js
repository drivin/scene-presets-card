import {LovelaceCardAdapter} from './adapters/lovelace-card-adapter.js';
import {ScenePresetsCard} from './components/scene-presets-card.js';
import {ScenePresetsEditor} from './components/scene-presets-editor.js';
import {VERSION} from './version.js';
const lovelace = new LovelaceCardAdapter();
lovelace.register('scene-presets-card', ScenePresetsCard);
lovelace.register('scene-presets-editor', ScenePresetsEditor);
lovelace.publishCard();
console.info(`Scene Presets Card ${VERSION}`);
