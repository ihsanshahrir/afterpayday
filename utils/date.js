import { LOCALE } from "./locale.js";

export const todayISO = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

export const currentMonthKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

// Uses startsWith(currentMonthKey()) to avoid timezone off-by-one from
// Date.parse treating bare YYYY-MM-DD strings as UTC midnight.
export const isInCurrentMonth = (isoDate) => {
  if (!isoDate) return false;
  return isoDate.startsWith(currentMonthKey());
};

export const isFixedPaidThisMonth = (expense) =>
  expense.paidMonth === currentMonthKey();

export const monthLabel = () =>
  new Date().toLocaleDateString(LOCALE, { month: "long", year: "numeric" });

// Parts → local-time Date. Avoids Date.parse's UTC-midnight behavior on
// bare YYYY-MM-DD strings, which previously shifted dates by a day in
// western timezones.
const localDate = (yy, mm, dd) => new Date(yy, mm - 1, dd ?? 1);

// "12 Jan 2026" in en-US, "12. Jan. 2026" in de-DE, etc.
export const fmtDate = (iso) => {
  if (!iso) return "";
  const [yy, mm, dd] = iso.split("-").map(Number);
  return localDate(yy, mm, dd).toLocaleDateString(LOCALE, {
    day: "numeric", month: "short", year: "numeric",
  });
};

// "Jan 2026" for the {month, year} pair — used by previews / pickers that
// don't have a day component.
export const fmtMonthYear = (year, month1) =>
  localDate(year, month1).toLocaleDateString(LOCALE, { month: "short", year: "numeric" });

// Lexicographic compare is safe for ISO dates; due-today is not overdue.
export const isOverdue = (iso) => Boolean(iso) && iso < todayISO();

// True when the ISO date falls in a month strictly before the current one.
// Lexicographic compare works because a bare "YYYY-MM" sorts below any
// "YYYY-MM-DD" in the same month, so only prior-month dates are matched.
export const isBeforeCurrentMonth = (iso) => Boolean(iso) && iso < currentMonthKey();

// `month` is 1-based (Jan = 1). `new Date(year, month, 0)` is day 0 of the
// next 0-indexed month, which is the last day of the 1-based month passed in.
export const daysInMonth = (month, year) => new Date(year, month, 0).getDate();
