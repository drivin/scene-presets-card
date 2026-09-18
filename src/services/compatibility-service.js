export class CompatibilityService {
  constructor(scene, storage, lovelace) { this.scene = scene; this.storage = storage; this.lovelace = lovelace; }
  getCapabilities() {
    const renderer = this.lovelace.capabilities();
    return {scenePresets: this.scene.getCapabilities(), homeAssistant: {
      userStorage: this.storage.available.user === true,
      globalStorage: this.storage.available.global === true,
      globalStorageWrite: this.storage.canWrite('global'), lovelaceCardHelpers: renderer.lovelaceCardHelpers,
    }, renderer: {buttonCard: renderer.buttonCard}};
  }
}
