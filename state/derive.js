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
