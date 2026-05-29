// Collision-resistant id. crypto.randomUUID is available in all target
// browsers (and Node 18+); fall back to a random base36 string only if it's
// somehow unavailable, so ids stay usable as React keys and mutation targets.
export const uid = () =>
  globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2, 10);
