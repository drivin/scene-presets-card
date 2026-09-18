import {LocalizedError} from '../localize/localize.js';
/**
 * EXTERNAL API
 * Project: Home Assistant core/frontend
 * Purpose: Cross-browser user/global favorites and user runtime settings.
 * Upstream interface: frontend/{get,set,subscribe}_{user,system}_data,
 * callWS and connection.subscribeMessage. Payload: {type,key,value?}.
 * Breaking-change risks: command availability, admin-only system writes, schema.
 * Verified against: core/dev frontend/storage.py and frontend/dev data/frontend.ts, 2026-09-18.
 */
export class HaStorageAdapter {
  constructor(hass) { this.hass = hass; this.available = {}; }
  kind(mode) { if (!['user','global'].includes(mode)) throw new LocalizedError('error.storage_mode'); return mode === 'global' ? 'system' : 'user'; }
  canWrite(mode) { return mode !== 'global' || this.hass.user?.is_admin === true; }
  async read(mode, key) {
    try {
      const response = await this.hass.callWS({type: `frontend/get_${this.kind(mode)}_data`, key});
      if (!response || !Object.hasOwn(response, 'value')) throw new LocalizedError('error.storage_response');
      this.available[mode] = true; return response.value;
    } catch (error) { this.available[mode] = false; throw error; }
  }
  async write(mode, key, value) {
    if (!this.canWrite(mode)) throw new LocalizedError('error.admin');
    return this.hass.callWS({type: `frontend/set_${this.kind(mode)}_data`, key, value});
  }
  async subscribe(mode, key, listener) {
    if (!this.hass.connection?.subscribeMessage) return null;
    try {
      return await this.hass.connection.subscribeMessage(data => listener(data.value), {
        type: `frontend/subscribe_${this.kind(mode)}_data`, key,
      });
    } catch { return null; } // Verified fallback: refresh on next load.
  }
}
