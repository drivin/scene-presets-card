import {LocalizedError} from '../localize/localize.js';
export function parseFavorites(value) {
  if (value == null) return [];
  if (value.version !== 1 || !Array.isArray(value.favorites) || value.favorites.some(id => typeof id !== 'string')) throw new LocalizedError('error.favorites_data');
  return [...new Set(value.favorites)];
}
export class FavoritesStore {
  constructor(adapter, config) {
    this.adapter = adapter; this.mode = config.mode;
    this.key = `scene_presets_card:favorites:${encodeURIComponent(config.namespace)}`;
    this.ids = []; this.queue = Promise.resolve(); this.closed = false;
  }
  async load(listener, onError = () => {}) {
    this.ids = parseFavorites(await this.adapter.read(this.mode, this.key));
    if (this.closed) return;
    listener(this.ids);
    const unsubscribe = await this.adapter.subscribe(this.mode, this.key, value => {
      if (this.closed) return;
      try { this.ids = parseFavorites(value); listener(this.ids); } catch (error) { onError(error); }
    });
    if (this.closed) unsubscribe?.(); else this.unsubscribe = unsubscribe;
    this.live = !this.closed && !!unsubscribe;
  }
  toggle(id) {
    const task = this.queue.catch(() => {}).then(async () => {
      // Refresh before writing; avoid overwriting changes received since page load.
      const ids = parseFavorites(await this.adapter.read(this.mode, this.key));
      const next = ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id];
      await this.adapter.write(this.mode, this.key, {version: 1, favorites: next});
      this.ids = next; return next;
    });
    this.queue = task; return task;
  }
  close() {
    if (this.closed) return;
    this.closed = true; this.unsubscribe?.(); this.unsubscribe = null; this.live = false;
  }
}
