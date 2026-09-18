import {getPresetCache} from './preset-cache.js';
export class PresetProvider {
  constructor(adapter) { this.adapter = adapter; this.cache = getPresetCache(adapter.source); }
  load(force = false) { return this.cache.load(this.adapter, force).then(data => { this.adapter.discovery = true; return data; }); }
  subscribe(listener) { return this.cache.subscribe(listener); }
}
