/**
 * Generate a collision-resistant unique id. Uses crypto.randomUUID when available
 * (all target browsers in secure contexts) and falls back to a random string.
 */
export function createId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') {
    return c.randomUUID();
  }
  // Fallback for non-secure contexts / very old engines.
  const bytes = new Uint8Array(16);
  if (c && typeof c.getRandomValues === 'function') {
    c.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      // Deterministic-ish fallback; only reached without any crypto support.
      bytes[i] = (i * 37 + 11) % 256;
    }
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
