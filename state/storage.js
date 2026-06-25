import { currentMonthKey } from "../utils/date.js";
import { uid } from "../utils/id.js";
import { CURRENCY_CODES, DEFAULT_CURRENCY } from "../utils/currencies.js";
import { PAYMENT_METHOD_IDS, RESERVED_CATEGORY_IDS } from "../utils/categories.js";

// The key name is historical and unrelated to the schema version below —
// changing it would orphan every user's saved data.
export const STORAGE_KEY = "expense-tracker:v1";
export const CURRENT_VERSION = 3;

// Fresh defaults on every call so loaded/imported state never shares array or
// object references with this module — a returned state can be safely mutated
// without corrupting the defaults used by the next load.
//
// `settings.categories` holds the user's CUSTOM categories only (built-ins live
// in utils/categories.js); it defaults to [] so old saves load unchanged.
const makeDefaultState = () => ({
  _version: CURRENT_VERSION,
  settings: { salary: 0, currency: DEFAULT_CURRENCY, categories: [] },
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
  if (data._version === 1) {
    // v1 → v2: refunds were stored as negative amounts with the category as a
    // hint. v2 keeps amounts positive and records direction explicitly in
    // `kind`. Installments gain an explicit paidMonth (null = settled in an
    // unknown prior month, matching how the runtime already treated missing
    // values).
    if (Array.isArray(data.dailyExpenses)) {
      data.dailyExpenses = data.dailyExpenses.map((e) => {
        if (!e || typeof e !== "object") return e;
        const amt = Number(e.amount);
        const isRefund = amt < 0 || e.category === "refund";
        return { ...e, amount: Math.abs(amt), kind: isRefund ? "refund" : "expense" };
      });
    }
    if (Array.isArray(data.debtGroups)) {
      data.debtGroups = data.debtGroups.map((g) =>
        g && typeof g === "object" && Array.isArray(g.installments)
          ? {
              ...g,
              installments: g.installments.map((i) =>
                i && typeof i === "object" ? { ...i, paidMonth: i.paidMonth ?? null } : i
              ),
            }
          : g
      );
    }
    data._version = 2;
  }
  if (data._version === 2) {
    // v2 → v3: the Add sheet split direction out of the category chips, so
    // "refund" is no longer a selectable category (it's recorded in `kind`,
    // which these rows already carry from the v1→v2 migration). Reset the
    // stale category to "other"; rendering already prefers `kind`, so this is
    // cleanup only. New optional fields (createdAt, merchant, paymentMethod,
    // tags, note) are intentionally left absent on old rows — the sanitizer
    // passes them through when present and omits them otherwise.
    if (Array.isArray(data.dailyExpenses)) {
      data.dailyExpenses = data.dailyExpenses.map((e) =>
        e && typeof e === "object" && e.category === "refund"
          ? { ...e, category: "other" }
          : e
      );
    }
    data._version = 3;
  }
  return data;
};

const MONTH_KEY_RE = /^\d{4}-\d{2}$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const isMonthKey = (v) => typeof v === "string" && MONTH_KEY_RE.test(v);
const isISODate = (v) => typeof v === "string" && ISO_DATE_RE.test(v);
const finiteOr = (v, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const MAX_TAGS = 12;
const MAX_TAG_LEN = 24;

// Optional free-text passes through only when it's a non-empty string; the
// field is omitted entirely otherwise so old saves and minimal entries stay
// lean and every consumer can guard on presence.
const optStr = (v) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

const sanitizeTags = (v) => {
  if (!Array.isArray(v)) return undefined;
  const tags = [];
  for (const t of v) {
    const s = optStr(t);
    if (s && !tags.includes(s)) tags.push(s.slice(0, MAX_TAG_LEN));
    if (tags.length >= MAX_TAGS) break;
  }
  return tags.length ? tags : undefined;
};

// Drops undefined keys so the stored object stays minimal (optional fields are
// only present when set).
const omitUndefined = (obj) => {
  const out = {};
  for (const k in obj) if (obj[k] !== undefined) out[k] = obj[k];
  return out;
};

// Per-item sanitizers. Items that can't be repaired (no usable amount/date)
// are dropped rather than left to poison the safe-to-spend math. Optional
// fields (createdAt, merchant, paymentMethod, tags, note) are passed through
// only when valid and omitted otherwise.
const sanitizeDaily = (e) => {
  if (!e || typeof e !== "object") return null;
  const amount = Number(e.amount);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (!isISODate(e.date)) return null;
  const createdAt = Number(e.createdAt);
  const paymentMethod =
    PAYMENT_METHOD_IDS.includes(e.paymentMethod) ? e.paymentMethod : undefined;
  return omitUndefined({
    id: typeof e.id === "string" && e.id ? e.id : uid(),
    amount,
    description: typeof e.description === "string" ? e.description : "",
    date: e.date,
    category: typeof e.category === "string" && e.category ? e.category : "other",
    kind: e.kind === "refund" ? "refund" : "expense",
    createdAt: Number.isFinite(createdAt) && createdAt > 0 ? createdAt : undefined,
    merchant: optStr(e.merchant),
    paymentMethod,
    tags: sanitizeTags(e.tags),
    note: optStr(e.note),
  });
};

// A user-defined custom category. Requires a usable id + label; rejects the
// reserved "refund" id; clamps the rest to sane presentational defaults.
const sanitizeCategory = (c) => {
  if (!c || typeof c !== "object") return null;
  const id = optStr(c.id);
  const label = optStr(c.label);
  if (!id || !label || RESERVED_CATEGORY_IDS.includes(id)) return null;
  return {
    id,
    label: label.slice(0, 24),
    icon: typeof c.icon === "string" && c.icon ? [...c.icon][0] : "•",
    color: typeof c.color === "string" && c.color ? c.color : "var(--fg-2)",
    bg: typeof c.bg === "string" && c.bg ? c.bg : "rgba(255,255,255,0.10)",
  };
};

const sanitizeFixed = (e) => {
  if (!e || typeof e !== "object") return null;
  const amount = Number(e.amount);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return {
    id: typeof e.id === "string" && e.id ? e.id : uid(),
    name: typeof e.name === "string" ? e.name : "",
    amount,
    paidMonth: isMonthKey(e.paidMonth) ? e.paidMonth : null,
  };
};

const sanitizeInstallment = (i) => {
  if (!i || typeof i !== "object") return null;
  const amount = Number(i.amount);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return {
    id: typeof i.id === "string" && i.id ? i.id : uid(),
    label: typeof i.label === "string" ? i.label : "",
    amount,
    dueDate: isISODate(i.dueDate) ? i.dueDate : null,
    isPaid: Boolean(i.isPaid),
    paidMonth: isMonthKey(i.paidMonth) ? i.paidMonth : null,
  };
};

const sanitizeGroup = (g) => {
  if (!g || typeof g !== "object") return null;
  const installments = Array.isArray(g.installments) ? g.installments : [];
  return {
    id: typeof g.id === "string" && g.id ? g.id : uid(),
    name: typeof g.name === "string" ? g.name : "",
    installments: installments.map(sanitizeInstallment).filter(Boolean),
  };
};

const sanitizeHistoryEntry = (h) => {
  if (!h || typeof h !== "object" || !isMonthKey(h.month)) return null;
  return {
    id: typeof h.id === "string" && h.id ? h.id : uid(),
    month: h.month,
    salary: finiteOr(h.salary, 0),
    fixedTotal: finiteOr(h.fixedTotal, 0),
    installments: finiteOr(h.installments, 0),
    dailySpent: finiteOr(h.dailySpent, 0),
    balance: finiteOr(h.balance, 0),
  };
};

// Shared normaliser: migrates, merges with fresh defaults, and validates every
// item so a truncated write or tampered JSON can't crash the app or skew the
// safe-to-spend math. Sanitizers run after migrate() because the v1→v2
// migration needs the raw negative amounts.
const normalizeState = (raw) => {
  const defaults = makeDefaultState();
  const migrated = migrate({ ...raw });
  const s = {
    ...defaults,
    ...migrated,
    settings: { ...defaults.settings, ...(migrated?.settings || {}) },
  };
  const salary = Number(s.settings.salary);
  s.settings.salary = Number.isFinite(salary) && salary >= 0 ? salary : 0;
  if (!CURRENCY_CODES.includes(s.settings.currency)) s.settings.currency = DEFAULT_CURRENCY;
  // Custom categories only (built-ins live in utils/categories.js). Validate
  // each and drop duplicate ids so the merged selectable list stays clean.
  {
    const seen = new Set();
    s.settings.categories = (Array.isArray(s.settings.categories) ? s.settings.categories : [])
      .map(sanitizeCategory)
      .filter((c) => c && !seen.has(c.id) && seen.add(c.id));
  }
  s.fixedExpenses = (Array.isArray(s.fixedExpenses) ? s.fixedExpenses : [])
    .map(sanitizeFixed).filter(Boolean);
  s.debtGroups = (Array.isArray(s.debtGroups) ? s.debtGroups : [])
    .map(sanitizeGroup).filter(Boolean);
  s.dailyExpenses = (Array.isArray(s.dailyExpenses) ? s.dailyExpenses : [])
    .map(sanitizeDaily).filter(Boolean);
  s.history = (Array.isArray(s.history) ? s.history : [])
    .map(sanitizeHistoryEntry).filter(Boolean);
  if (!isMonthKey(s.currentMonth)) s.currentMonth = currentMonthKey();
  s._version = CURRENT_VERSION;
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
