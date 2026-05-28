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

export const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// Format a bare YYYY-MM-DD string without Date.parse to avoid UTC off-by-one.
export const fmtDate = (iso) => {
  if (!iso) return "";
  const [yy, mm, dd] = iso.split("-").map(Number);
  return `${dd} ${MONTHS_SHORT[mm - 1]} ${yy}`;
};

// Lexicographic compare is safe for ISO dates; due-today is not overdue.
export const isOverdue = (iso) => Boolean(iso) && iso < todayISO();
