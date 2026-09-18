import {LocalizedError} from '../localize/localize.js';
import {normalizeScene} from '../models/card-config.js';
export class RuntimeStore {
  constructor(adapter, key) { this.adapter = adapter; this.key = `scene_presets_card:runtime:${encodeURIComponent(key)}`; this.queue = Promise.resolve(); }
  async load(defaults) {
    const value = await this.adapter.read('user', this.key);
    if (value == null) return defaults;
    if (value.version !== 1 || !value.scene) throw new LocalizedError('error.runtime_data');
    return normalizeScene(value.scene);
  }
  save(scene) {
    const value = {version: 1, scene: structuredClone(scene)};
    this.queue = this.queue.catch(() => {}).then(() => this.adapter.write('user', this.key, value));
    return this.queue;
  }
}
