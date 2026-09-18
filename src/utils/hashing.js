export function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
export async function fingerprint(data) {
  const normalized = {categories: [...data.categories].sort(byId), presets: [...data.presets].sort(byId)};
  const bytes = new TextEncoder().encode(stableStringify(normalized));
  // Web Crypto requires a secure context. Canonical content is an exact fallback,
  // retained only in memory; debug output never exposes raw data.
  if (!globalThis.crypto?.subtle) return stableStringify(normalized);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
}
const byId = (a, b) => a.id.localeCompare(b.id);
