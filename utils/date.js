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

// The "YYYY-MM" immediately after the given one. `mm` from the split is
// 1-based, so passing it (unadjusted) as the 0-based month arg with day=1
// lands on the first of the following month.
export const nextMonthKey = (monthKey) => {
  const [yyyy, mm] = monthKey.split("-").map(Number);
  const d = new Date(yyyy, mm, 1);
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

// Yesterday in local time as YYYY-MM-DD. Built from local Date parts (not
// string math) so it stays correct across month/year boundaries and DST.
const yesterdayISO = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
};

// Friendly day label for list rows: "Today" / "Yesterday" / else the full date.
export const fmtRelativeDay = (iso) => {
  if (!iso) return "";
  if (iso === todayISO()) return "Today";
  if (iso === yesterdayISO()) return "Yesterday";
  return fmtDate(iso);
};

// Locale-aware "14:32" / "2:32 PM" from an epoch-ms timestamp. Returns "" when
// the timestamp is missing (back-dated / pre-v3 rows carry no createdAt).
export const fmtTime = (ts) => {
  if (!Number.isFinite(ts)) return "";
  return new Date(ts).toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit" });
};

// Lexicographic compare is safe for ISO dates; due-today is not overdue.
export const isOverdue = (iso) => Boolean(iso) && iso < todayISO();

// True when the ISO date falls in a month strictly before the current one.
// Lexicographic compare works because a bare "YYYY-MM" sorts below any
// "YYYY-MM-DD" in the same month, so only prior-month dates are matched.
export const isBeforeCurrentMonth = (iso) => Boolean(iso) && iso < currentMonthKey();

// `month` is 1-based (Jan = 1). `new Date(year, month, 0)` is day 0 of the
// next 0-indexed month, which is the last day of the 1-based month passed in.
export const daysInMonth = (month, year) => new Date(year, month, 0).getDate();
