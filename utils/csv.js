// Export daily expenses as CSV for data portability. Pure and on-device — the
// file is built in the browser and downloaded; nothing leaves the device.

import { mergeCategories, DEFAULT_CATEGORY_ID } from "./categories.js";

const COLUMNS = [
  "date", "time", "kind", "category", "amount",
  "description", "merchant", "paymentMethod", "tags", "note",
];

// RFC-4180 style escaping: wrap in quotes and double any embedded quote when the
// value contains a comma, quote, or newline. Also guards against CSV/formula
// injection (CWE-1236): a field starting with =, +, -, @, tab, or CR gets a
// leading apostrophe so spreadsheet apps (Excel, Sheets, LibreOffice) treat it
// as text instead of evaluating it as a formula — relevant because description/
// merchant can originate from a scanned receipt someone else handed the user.
const esc = (v) => {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// Pass `customCategories` (settings.categories) so custom-category ids resolve to
// the human-readable label the user entered rather than the opaque "c-…" id. The
// `kind` column already carries direction, so we resolve the category by id only
// (no refund override) and fall back to the default label for unknown ids.
export const toDailyCSV = (dailyExpenses = [], customCategories = []) => {
  const cats = mergeCategories(customCategories);
  const fallback = cats.find((c) => c.id === DEFAULT_CATEGORY_ID);
  const labelFor = (id) => {
    const m = cats.find((c) => c.id === id);
    if (m) return m.label;
    return fallback ? fallback.label : (id || "");
  };
  const rows = (Array.isArray(dailyExpenses) ? dailyExpenses : []).map((e) =>
    [
      e.date || "",
      Number.isFinite(e.createdAt) ? new Date(e.createdAt).toISOString() : "",
      e.kind === "refund" ? "refund" : "expense",
      labelFor(e.category),
      Number.isFinite(Number(e.amount)) ? Number(e.amount) : 0,
      e.description || "",
      e.merchant || "",
      e.paymentMethod || "",
      Array.isArray(e.tags) ? e.tags.join("|") : "",
      e.note || "",
    ].map(esc).join(",")
  );
  return [COLUMNS.join(","), ...rows].join("\r\n");
};
