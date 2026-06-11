import { describe, it, expect } from "vitest";
import {
  signedDailyAmount,
  dailyTotalForMonth,
  fixedGrandTotal,
  fixedUnpaidTotal,
  fixedPaidForMonth,
  installmentTotals,
  computeSafeToSpend,
  computeSpentThisMonth,
  buildMonthSnapshot,
} from "./derive.js";

const M = "2026-06";

const daily = (amount, kind = "expense", date = `${M}-10`) => ({
  id: "d", amount, description: "", date, category: "other", kind,
});

const inst = (amount, dueDate, isPaid = false, paidMonth = null) => ({
  id: "i", label: "", amount, dueDate, isPaid, paidMonth,
});

const emptyState = {
  settings: { salary: 0, currency: "RM" },
  fixedExpenses: [],
  debtGroups: [],
  dailyExpenses: [],
};

describe("signedDailyAmount", () => {
  it("counts expenses positive and refunds negative", () => {
    expect(signedDailyAmount(daily(50))).toBe(50);
    expect(signedDailyAmount(daily(20, "refund"))).toBe(-20);
  });
});

describe("dailyTotalForMonth", () => {
  it("nets refunds against expenses", () => {
    expect(dailyTotalForMonth([daily(50), daily(20, "refund")], M)).toBe(30);
  });

  it("ignores other months and missing dates", () => {
    expect(
      dailyTotalForMonth(
        [daily(50), daily(99, "expense", "2026-05-10"), { ...daily(10), date: null }],
        M
      )
    ).toBe(50);
  });
});

describe("fixed expense totals", () => {
  const fixed = [
    { id: "a", name: "Rent", amount: 800, paidMonth: M },
    { id: "b", name: "Wifi", amount: 100, paidMonth: null },
    { id: "c", name: "Gym", amount: 50, paidMonth: "2026-05" },
  ];

  it("fixedGrandTotal sums everything regardless of payment", () => {
    expect(fixedGrandTotal(fixed)).toBe(950);
  });

  it("fixedUnpaidTotal excludes only items paid this month", () => {
    expect(fixedUnpaidTotal(fixed, M)).toBe(150);
  });

  it("fixedPaidForMonth counts only items paid in that month", () => {
    expect(fixedPaidForMonth(fixed, M)).toBe(800);
    expect(fixedPaidForMonth(fixed, "2026-05")).toBe(50);
  });
});

describe("installmentTotals", () => {
  it("buckets due, unpaid, and paid for the month", () => {
    const groups = [{
      id: "g", name: "Car",
      installments: [
        inst(500, `${M}-15`, false),
        inst(500, `${M}-20`, true, M),
        inst(500, "2026-07-15", false),
      ],
    }];
    const t = installmentTotals(groups, M);
    expect(t.dueThisMonth).toBe(1000);
    expect(t.unpaidThisMonth).toBe(500);
    expect(t.paidThisMonth).toBe(500);
    expect(t.overdueUnpaid).toBe(0);
    expect(t.overduePaidThisMonth).toBe(0);
  });

  it("counts prior-month unpaid as overdueUnpaid", () => {
    const groups = [{ id: "g", name: "", installments: [inst(300, "2026-04-15", false)] }];
    expect(installmentTotals(groups, M).overdueUnpaid).toBe(300);
  });

  it("counts overdue caught up this month, and treats paidMonth null as settled prior", () => {
    const groups = [{
      id: "g", name: "",
      installments: [
        inst(300, "2026-04-15", true, M),     // caught up this month
        inst(200, "2026-03-15", true, null),  // settled in an unknown prior month
        inst(100, "2026-02-15", true, "2026-05"), // settled last month
      ],
    }];
    const t = installmentTotals(groups, M);
    expect(t.overduePaidThisMonth).toBe(300);
    expect(t.overdueUnpaid).toBe(0);
  });

  it("skips installments without a due date", () => {
    const groups = [{ id: "g", name: "", installments: [inst(500, null, false)] }];
    const t = installmentTotals(groups, M);
    expect(t.dueThisMonth + t.unpaidThisMonth + t.overdueUnpaid).toBe(0);
  });
});

describe("computeSafeToSpend", () => {
  it("matches salary − fixed grand total − due this month − overdue owed − net daily", () => {
    const state = {
      settings: { salary: 5000 },
      fixedExpenses: [
        { id: "a", name: "Rent", amount: 800, paidMonth: M },
        { id: "b", name: "Wifi", amount: 100, paidMonth: null },
      ],
      debtGroups: [{
        id: "g", name: "",
        installments: [
          inst(500, `${M}-15`, false),
          inst(300, "2026-04-15", false),       // overdue unpaid
          inst(200, "2026-03-15", true, M),     // overdue caught up this month
        ],
      }],
      dailyExpenses: [daily(150), daily(50, "refund")],
    };
    // 5000 − 900 − 500 − (300 + 200) − 100 = 3000
    expect(computeSafeToSpend(state, M)).toBe(3000);
  });

  it("a refund increases safe-to-spend", () => {
    const base = { ...emptyState, settings: { salary: 1000 }, dailyExpenses: [daily(100)] };
    const withRefund = { ...base, dailyExpenses: [...base.dailyExpenses, daily(40, "refund")] };
    expect(computeSafeToSpend(withRefund, M)).toBe(computeSafeToSpend(base, M) + 40);
  });

  it("returns the salary for an empty state", () => {
    expect(computeSafeToSpend({ ...emptyState, settings: { salary: 1234 } }, M)).toBe(1234);
    expect(computeSafeToSpend(emptyState, M)).toBe(0);
  });
});

describe("computeSpentThisMonth", () => {
  it("sums paid fixed + paid installments + net daily, ignoring unpaid commitments", () => {
    const state = {
      settings: { salary: 5000 },
      fixedExpenses: [
        { id: "a", name: "Rent", amount: 800, paidMonth: M },
        { id: "b", name: "Wifi", amount: 100, paidMonth: null }, // unpaid: excluded
      ],
      debtGroups: [{
        id: "g", name: "",
        installments: [
          inst(500, `${M}-15`, true, M),
          inst(500, `${M}-20`, false), // unpaid: excluded
        ],
      }],
      dailyExpenses: [daily(150), daily(50, "refund")],
    };
    expect(computeSpentThisMonth(state, M)).toBe(800 + 500 + 100);
  });
});

describe("buildMonthSnapshot", () => {
  it("counts only paid fixed and paid installments, nets refunds, and balances", () => {
    const state = {
      settings: { salary: 4000 },
      fixedExpenses: [
        { id: "a", name: "Rent", amount: 800, paidMonth: M },
        { id: "b", name: "Wifi", amount: 100, paidMonth: null },
      ],
      debtGroups: [{
        id: "g", name: "",
        installments: [
          inst(500, `${M}-15`, true, M),
          inst(500, `${M}-20`, false),
        ],
      }],
      dailyExpenses: [daily(300), daily(100, "refund")],
    };
    const snap = buildMonthSnapshot(state, M);
    expect(snap.month).toBe(M);
    expect(snap.salary).toBe(4000);
    expect(snap.fixedTotal).toBe(800);
    expect(snap.installments).toBe(500);
    expect(snap.dailySpent).toBe(200);
    expect(snap.balance).toBe(4000 - 800 - 500 - 200);
  });

  it("yields zeros for an empty state", () => {
    const snap = buildMonthSnapshot(emptyState, M);
    expect(snap.fixedTotal).toBe(0);
    expect(snap.installments).toBe(0);
    expect(snap.dailySpent).toBe(0);
    expect(snap.balance).toBe(0);
  });
});
