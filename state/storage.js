import { currentMonthKey } from "../utils/date.js";

export const STORAGE_KEY = "expense-tracker:v1";
export const CURRENT_VERSION = 1;

// Fresh defaults on every call so loaded/imported state never shares array or
// object references with this module — a returned state can be safely mutated
// without corrupting the defaults used by the next load.
const makeDefaultState = () => ({
  _version: CURRENT_VERSION,
  settings: { salary: 0, currency: "RM" },
  fixedExpenses: [],
  debtGroups: [],
  dailyExpenses: [],
  history: [],
  currentMonth: currentMonthKey(),
});

// Runs forward migrations so old saves stay compatible.
// Bump CURRENT_VERSION and add a case here whenever the shape changes.
const migrate = (data) => {
  if (!data._version) {
    // v0 (pre-versioning) → v1: no structural change, just stamp the version.
    data._version = 1;
  }
  return data;
};

// Shared normaliser: migrates, merges with fresh defaults, and coerces every
// array field so a truncated write or tampered JSON can't crash the app.
const normalizeState = (raw) => {
  const defaults = makeDefaultState();
  const migrated = migrate({ ...raw });
  const s = {
    ...defaults,
    ...migrated,
    settings: { ...defaults.settings, ...(migrated?.settings || {}) },
  };
  if (!Array.isArray(s.fixedExpenses)) s.fixedExpenses = [];
  if (!Array.isArray(s.debtGroups)) s.debtGroups = [];
  if (!Array.isArray(s.dailyExpenses)) s.dailyExpenses = [];
  if (!Array.isArray(s.history)) s.history = [];
  if (!s.currentMonth) s.currentMonth = currentMonthKey();
  return s;
};

export const loadState = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return normalizeState(raw ? JSON.parse(raw) : {});
  } catch {
    return makeDefaultState();
  }
};

// Validates and normalises a parsed backup object.
// Returns null if the input is not a recognisable AfterPayday backup.
export const importState = (parsed) => {
  try {
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return normalizeState(parsed);
  } catch {
    return null;
  }
};

// Returns true on success, false when localStorage quota is exceeded.
// Callers should surface a warning to the user on false.
export const saveState = (state) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    if (
      e instanceof DOMException &&
      (e.name === "QuotaExceededError" || e.name === "NS_ERROR_DOM_QUOTA_REACHED")
    ) {
      return false;
    }
    return false;
  }
};
