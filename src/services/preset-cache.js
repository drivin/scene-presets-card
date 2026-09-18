import {fingerprint} from '../utils/hashing.js';
const caches = new Map();
export class PresetCache {
  constructor() { this.snapshot = null; this.pending = null; this.listeners = new Set(); }
  subscribe(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  async load(adapter, force = false) {
    if (this.pending) return this.pending;
    if (!force && this.snapshot && Date.now() - this.snapshot.lastValidation < 60000) return this.snapshot;
    this.pending = this.validate(adapter).finally(() => { this.pending = null; });
    return this.pending;
  }
  async validate(adapter) {
    const raw = await adapter.loadPresets();
    const sourceFingerprint = await fingerprint(raw);
    if (this.snapshot?.sourceFingerprint === sourceFingerprint) {
      this.snapshot.lastValidation = Date.now(); this.snapshot.status = 'unchanged';
    } else {
      const categories = raw.categories.map(c => adapter.normalizeCategory(c));
      const lookup = new Map(categories.map(c => [c.id, c]));
      this.snapshot = {schemaVersion: 1, sourceFingerprint, categories,
        presets: raw.presets.map(p => adapter.normalizePreset(p, lookup)), lastValidation: Date.now(), status: 'updated'};
    }
    for (const listener of this.listeners) listener(this.snapshot);
    return this.snapshot;
  }
}
export function getPresetCache(source) {
  if (!caches.has(source)) caches.set(source, new PresetCache());
  return caches.get(source);
}
