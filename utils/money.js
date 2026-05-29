import { LOCALE } from "./locale.js";

export const fmtNum = (n) =>
  (Number.isFinite(n) ? n : 0).toLocaleString(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const formatMoney = (n, currency = "RM") => `${currency} ${fmtNum(n)}`;

export const fmtCompact = (n) =>
  new Intl.NumberFormat(LOCALE, { notation: "compact", maximumFractionDigits: 1 }).format(
    Number.isFinite(n) ? n : 0
  );

// Splits `total` into `n` parts rounded to 2 dp. Each part is floored to the
// cent and the final part absorbs the remainder, so the parts always sum to
// `total` exactly (no penny drift across installments).
export const splitEvenly = (total, n) => {
  if (!Number.isFinite(total) || !Number.isInteger(n) || n <= 0) return [];
  const base = Math.floor((total / n) * 100) / 100;
  const parts = Array.from({ length: n }, () => base);
  parts[n - 1] = +(total - base * (n - 1)).toFixed(2);
  return parts;
};
