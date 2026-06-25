// Presentational metadata for daily-expense categories.
//
// `category` on a daily expense is presentational only — `kind`
// (expense | refund) is the source of truth for direction. These built-ins
// ship with the app and are fixed; users can ADD their own custom categories,
// stored in `settings.categories` (custom-only, defaults to []), which merge on
// top of the built-ins by id. This keeps the curated out-of-box set intact
// while staying extensible ("curated + add your own").

export const DEFAULT_CATEGORY_ID = "other";

export const DEFAULT_CATEGORIES = [
  { id: "food",  label: "Food",  icon: "☕", color: "var(--amber)",  bg: "rgba(252,211,77,0.18)" },
  { id: "fuel",  label: "Fuel",  icon: "⛽", color: "var(--violet)", bg: "rgba(167,139,250,0.18)" },
  { id: "shop",  label: "Shop",  icon: "🛍", color: "var(--pink)",   bg: "rgba(249,168,212,0.18)" },
  { id: "other", label: "Other", icon: "•",  color: "var(--fg-2)",   bg: "rgba(255,255,255,0.10)" },
];

// Refund is a direction (`kind`), not a selectable category, but rows still
// need a glyph — resolved for any row whose kind is "refund".
export const REFUND_META = {
  id: "refund", label: "Refund", icon: "↺", color: "var(--emerald)", bg: "rgba(52,211,153,0.18)",
};

const DEFAULT_META = DEFAULT_CATEGORIES.find((c) => c.id === DEFAULT_CATEGORY_ID);

// Reserved ids a custom category may not reuse (would shadow direction/fallback
// semantics). Built-in ids are allowed to be re-themed by a custom entry.
export const RESERVED_CATEGORY_IDS = ["refund"];

// A bounded palette for custom categories — keeps the design coherent without a
// full colour picker. Each entry pairs a solid accent with its translucent fill.
export const CATEGORY_COLORS = [
  { color: "var(--amber)",   bg: "rgba(252,211,77,0.18)" },
  { color: "var(--violet)",  bg: "rgba(167,139,250,0.18)" },
  { color: "var(--pink)",    bg: "rgba(249,168,212,0.18)" },
  { color: "var(--emerald)", bg: "rgba(52,211,153,0.18)" },
  { color: "var(--rose)",    bg: "rgba(244,63,94,0.18)" },
  { color: "#60a5fa",        bg: "rgba(96,165,250,0.18)" },
];

// Payment methods are a small fixed set (not user-defined) so the optional
// field stays low-friction and the sanitizer can validate it.
export const PAYMENT_METHODS = [
  { id: "cash",    label: "Cash",     icon: "💵" },
  { id: "card",    label: "Card",     icon: "💳" },
  { id: "ewallet", label: "E-wallet", icon: "📱" },
  { id: "other",   label: "Other",    icon: "•" },
];
export const PAYMENT_METHOD_IDS = PAYMENT_METHODS.map((p) => p.id);

// The full ordered selectable list: built-ins first, then the user's custom
// categories (a custom entry sharing a built-in id overrides it in place).
export const mergeCategories = (custom) => {
  const list = DEFAULT_CATEGORIES.map((c) => ({ ...c }));
  if (Array.isArray(custom)) {
    for (const c of custom) {
      if (!c || typeof c.id !== "string") continue;
      const i = list.findIndex((d) => d.id === c.id);
      if (i >= 0) list[i] = { ...list[i], ...c };
      else list.push(c);
    }
  }
  return list;
};

// Presentational meta for a category id. Refund rows always resolve to the
// refund glyph regardless of the stored category; unknown ids fall back to
// "Other" so a deleted custom category never renders blank.
export const categoryMeta = (custom, id, kind) => {
  if (kind === "refund") return REFUND_META;
  const all = mergeCategories(custom);
  return all.find((c) => c.id === id) || DEFAULT_META;
};

export const paymentMethodMeta = (id) =>
  PAYMENT_METHODS.find((p) => p.id === id) || null;
