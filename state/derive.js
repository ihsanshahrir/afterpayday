// Pure derivations of the app's money figures. Every function takes an
// explicit monthKey ("YYYY-MM") instead of reading the clock, so the same
// code serves the live dashboard (current month) and the rollover snapshot
// (the month being closed) — and is trivially testable.
//
// Date filtering uses ISO-string prefix matching, mirroring utils/date.js,
// to stay timezone-safe.

// Amounts are stored positive; `kind` records direction. A refund is money
// coming back in, so it counts negative against spending totals.
export const signedDailyAmount = (e) =>
  e.kind === "refund" ? -Number(e.amount || 0) : Number(e.amount || 0);

export const dailyTotalForMonth = (dailyExpenses, monthKey) =>
  dailyExpenses
    .filter((e) => typeof e.date === "string" && e.date.startsWith(monthKey))
    .reduce((s, e) => s + signedDailyAmount(e), 0);

// Newest-first creation time; entries that predate the `createdAt` field (or are
// back-dated) sort as oldest within their day.
const createdTs = (e) => (Number.isFinite(e.createdAt) ? e.createdAt : 0);

// Group a month's daily expenses by calendar day, newest day first. Each group
// carries its net subtotal (refunds subtract, mirroring signedDailyAmount) so
// the UI can show an at-a-glance daily spend. Items within a day are ordered
// newest-first by createdAt when present.
export const groupDailyByDay = (dailyExpenses, monthKey) => {
  const byDay = new Map();
  for (const e of dailyExpenses) {
    if (typeof e.date !== "string" || !e.date.startsWith(monthKey)) continue;
    if (!byDay.has(e.date)) byDay.set(e.date, []);
    byDay.get(e.date).push(e);
  }
  return [...byDay.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0))
    .map(([date, items]) => ({
      date,
      items: items.slice().sort((a, b) => createdTs(b) - createdTs(a)),
      subtotal: items.reduce((s, e) => s + signedDailyAmount(e), 0),
    }));
};

// Distinct recent {description, category} pairs for quick re-add, most-recent
// first, deduped by lowercased description. Refund rows are skipped — a
// suggestion always seeds an expense (the user can flip direction). Pure so it
// can be unit-tested and memoised by the caller.
export const recentDailySuggestions = (dailyExpenses, limit = 4) => {
  const seen = new Set();
  const out = [];
  for (const e of dailyExpenses) {
    if (e.kind === "refund") continue;
    const desc = typeof e.description === "string" ? e.description.trim() : "";
    if (!desc) continue;
    const key = desc.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ description: desc, category: e.category || "other" });
    if (out.length >= limit) break;
  }
  return out;
};

// Text/category/kind filter + sort over a list of daily expenses. Used by the
// month-view search bar. `text` matches description, merchant, note, category,
// and tags. Returns a new array (never mutates the input).
export const filterDailyExpenses = (list, query = {}) => {
  const { text = "", category = "all", kind = "all", sort = "date-desc" } = query;
  const q = text.trim().toLowerCase();
  const filtered = list.filter((e) => {
    if (category !== "all" && (e.category || "other") !== category) return false;
    const dir = e.kind === "refund" ? "refund" : "expense";
    if (kind !== "all" && dir !== kind) return false;
    if (q) {
      const hay = [e.description, e.merchant, e.note, e.category, ...(Array.isArray(e.tags) ? e.tags : [])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  const cmp = {
    "date-desc": (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : createdTs(b) - createdTs(a)),
    "date-asc": (a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : createdTs(a) - createdTs(b)),
    "amount-desc": (a, b) => Math.abs(Number(b.amount)) - Math.abs(Number(a.amount)),
    "amount-asc": (a, b) => Math.abs(Number(a.amount)) - Math.abs(Number(b.amount)),
  }[sort];
  return cmp ? filtered.slice().sort(cmp) : filtered;
};

// True when the month-view filter differs from its defaults — drives whether the
// list shows flat filtered results vs. the day-grouped view.
export const isDailyFilterActive = (query = {}) =>
  Boolean(
    (query.text && query.text.trim()) ||
      (query.category && query.category !== "all") ||
      (query.kind && query.kind !== "all") ||
      (query.sort && query.sort !== "date-desc")
  );

export const fixedGrandTotal = (fixedExpenses) =>
  fixedExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);

export const fixedUnpaidTotal = (fixedExpenses, monthKey) =>
  fixedExpenses
    .filter((e) => e.paidMonth !== monthKey)
    .reduce((s, e) => s + Number(e.amount || 0), 0);

export const fixedPaidForMonth = (fixedExpenses, monthKey) =>
  fixedExpenses
    .filter((e) => e.paidMonth === monthKey)
    .reduce((s, e) => s + Number(e.amount || 0), 0);

// Single pass over all installments, bucketed relative to monthKey:
// - dueThisMonth / unpaidThisMonth / paidThisMonth: due date inside the month
// - overdueUnpaid: due before the month and still unpaid — still owed, so it
//   must keep reducing safe-to-spend
// - overduePaidThisMonth: due before the month but caught up during it. The
//   cash left the account now, so it reduces this month's safe-to-spend; it
//   ages out next month because paidMonth no longer matches. Installments
//   with paidMonth null were settled in an unknown prior month and are
//   excluded.
export const installmentTotals = (debtGroups, monthKey) => {
  const totals = {
    dueThisMonth: 0,
    unpaidThisMonth: 0,
    paidThisMonth: 0,
    overdueUnpaid: 0,
    overduePaidThisMonth: 0,
  };
  debtGroups.forEach((g) => {
    g.installments.forEach((i) => {
      const amount = Number(i.amount || 0);
      if (typeof i.dueDate !== "string") return;
      if (i.dueDate.startsWith(monthKey)) {
        totals.dueThisMonth += amount;
        if (i.isPaid) totals.paidThisMonth += amount;
        else totals.unpaidThisMonth += amount;
      } else if (i.dueDate.slice(0, 7) < monthKey) {
        if (!i.isPaid) totals.overdueUnpaid += amount;
        else if (i.paidMonth === monthKey) totals.overduePaidThisMonth += amount;
      }
    });
  });
  return totals;
};

// salary − all fixed bills (paid or not) − everything due this month −
// overdue still owed or caught up this month − net daily spending.
export const computeSafeToSpend = (state, monthKey) => {
  const inst = installmentTotals(state.debtGroups, monthKey);
  return (
    Number(state.settings.salary || 0) -
    fixedGrandTotal(state.fixedExpenses) -
    inst.dueThisMonth -
    (inst.overdueUnpaid + inst.overduePaidThisMonth) -
    dailyTotalForMonth(state.dailyExpenses, monthKey)
  );
};

// Money that has actually left the account: paid fixed bills, paid
// installments, and net daily spending. Unpaid commitments affect the
// forward-looking safe-to-spend but should not inflate the progress bar.
export const computeSpentThisMonth = (state, monthKey) =>
  fixedPaidForMonth(state.fixedExpenses, monthKey) +
  installmentTotals(state.debtGroups, monthKey).paidThisMonth +
  dailyTotalForMonth(state.dailyExpenses, monthKey);

// History entry for a month being closed by the rollover. Only counts fixed
// expenses and installments the user marked paid — unpaid amounts roll
// forward as overdue rather than retroactively reducing the closed month's
// balance. The caller adds the entry id.
export const buildMonthSnapshot = (state, closedMonthKey) => {
  const salary = Number(state.settings.salary || 0);
  const fixedTotal = fixedPaidForMonth(state.fixedExpenses, closedMonthKey);
  const installments = installmentTotals(state.debtGroups, closedMonthKey).paidThisMonth;
  const dailySpent = dailyTotalForMonth(state.dailyExpenses, closedMonthKey);
  return {
    month: closedMonthKey,
    salary,
    fixedTotal,
    installments,
    dailySpent,
    balance: salary - fixedTotal - installments - dailySpent,
  };
};
