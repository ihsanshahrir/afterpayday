import { beforeEach } from "vitest";

// Node 22+ ships a built-in experimental globalThis.localStorage (Web Storage
// API) that shadows jsdom's mock but is non-functional without
// --localstorage-file (e.g. `clear` is undefined). Install a deterministic
// in-memory localStorage before each test so the storage layer is exercised
// against a working API regardless of Node version.
beforeEach(() => {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
    key: (i) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  };
});
