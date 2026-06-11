import { currentMonthKey } from "../utils/date.js";
import { uid } from "../utils/id.js";
import { CURRENCY_CODES, DEFAULT_CURRENCY } from "../utils/currencies.js";

// The key name is historical and unrelated to the schema version below —
// changing it would orphan every user's saved data.
export const STORAGE_KEY = "expense-tracker:v1";
export const CURRENT_VERSION = 2;

// Fresh defaults on every call so loaded/imported state never shares array or
// object references with this module — a returned state can be safely mutated
// without corrupting the defaults used by the next load.
const makeDefaultState = () => ({
  _version: CURRENT_VERSION,
  settings: { salary: 0, currency: DEFAULT_CURRENCY },
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

// Per-item sanitizers. Items that can't be repaired (no usable amount/date)
// are dropped rather than left to poison the safe-to-spend math.
const sanitizeDaily = (e) => {
  if (!e || typeof e !== "object") return null;
  const amount = Number(e.amount);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (!isISODate(e.date)) return null;
  return {
    id: typeof e.id === "string" && e.id ? e.id : uid(),
    amount,
    description: typeof e.description === "string" ? e.description : "",
    date: e.date,
    category: typeof e.category === "string" && e.category ? e.category : "other",
    kind: e.kind === "refund" ? "refund" : "expense",
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
