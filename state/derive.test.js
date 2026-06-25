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
  groupDailyByDay,
  recentDailySuggestions,
  filterDailyExpenses,
  isDailyFilterActive,
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

describe("groupDailyByDay", () => {
  it("groups by day, newest day first, with net subtotals", () => {
    const list = [
      { id: "1", amount: 10, date: `${M}-12`, kind: "expense", category: "food" },
      { id: "2", amount: 5, date: `${M}-10`, kind: "expense", category: "food" },
      { id: "3", amount: 4, date: `${M}-10`, kind: "refund", category: "other" },
    ];
    const groups = groupDailyByDay(list, M);
    expect(groups.map((g) => g.date)).toEqual([`${M}-12`, `${M}-10`]);
    expect(groups[0].subtotal).toBe(10);
    expect(groups[1].subtotal).toBe(1); // 5 expense − 4 refund
    expect(groups[1].items).toHaveLength(2);
  });

  it("orders items within a day newest-first by createdAt", () => {
    const list = [
      { id: "old", amount: 1, date: `${M}-10`, kind: "expense", createdAt: 100 },
      { id: "new", amount: 2, date: `${M}-10`, kind: "expense", createdAt: 200 },
    ];
    expect(groupDailyByDay(list, M)[0].items.map((e) => e.id)).toEqual(["new", "old"]);
  });

  it("ignores other months and missing dates", () => {
    const list = [
      { id: "1", amount: 10, date: `${M}-12`, kind: "expense" },
      { id: "2", amount: 99, date: "2026-05-10", kind: "expense" },
      { id: "3", amount: 5, date: null, kind: "expense" },
    ];
    expect(groupDailyByDay(list, M)).toHaveLength(1);
  });
});

describe("recentDailySuggestions", () => {
  it("returns distinct recent descriptions, deduped case-insensitively, skipping refunds and blanks", () => {
    const list = [
      { description: "Coffee", category: "food", kind: "expense" },
      { description: "coffee", category: "food", kind: "expense" },
      { description: "", category: "other", kind: "expense" },
      { description: "Refunded", category: "shop", kind: "refund" },
      { description: "Fuel", category: "fuel", kind: "expense" },
    ];
    expect(recentDailySuggestions(list, 4)).toEqual([
      { description: "Coffee", category: "food" },
      { description: "Fuel", category: "fuel" },
    ]);
  });

  it("respects the limit", () => {
    const list = [
      { description: "a", category: "food", kind: "expense" },
      { description: "b", category: "food", kind: "expense" },
      { description: "c", category: "food", kind: "expense" },
    ];
    expect(recentDailySuggestions(list, 2)).toHaveLength(2);
  });
});

describe("filterDailyExpenses", () => {
  const list = [
    { id: "1", amount: 30, date: `${M}-12`, kind: "expense", category: "food", description: "Lunch", merchant: "Cafe", tags: ["work"] },
    { id: "2", amount: 10, date: `${M}-10`, kind: "refund", category: "shop", description: "Return", note: "shoes" },
    { id: "3", amount: 50, date: `${M}-11`, kind: "expense", category: "fuel", description: "Petrol" },
  ];

  it("filters by free text across description, merchant, tags, note", () => {
    expect(filterDailyExpenses(list, { text: "cafe" }).map((e) => e.id)).toEqual(["1"]);
    expect(filterDailyExpenses(list, { text: "shoes" }).map((e) => e.id)).toEqual(["2"]);
    expect(filterDailyExpenses(list, { text: "work" }).map((e) => e.id)).toEqual(["1"]);
  });

  it("filters by category and kind", () => {
    expect(filterDailyExpenses(list, { category: "fuel" }).map((e) => e.id)).toEqual(["3"]);
    expect(filterDailyExpenses(list, { kind: "refund" }).map((e) => e.id)).toEqual(["2"]);
  });

  it("sorts by amount and date without mutating the input", () => {
    const before = list.map((e) => e.id);
    expect(filterDailyExpenses(list, { sort: "amount-desc" }).map((e) => e.id)).toEqual(["3", "1", "2"]);
    expect(filterDailyExpenses(list, { sort: "date-asc" }).map((e) => e.id)).toEqual(["2", "3", "1"]);
    expect(list.map((e) => e.id)).toEqual(before);
  });
});

describe("isDailyFilterActive", () => {
  it("is false for defaults and true for any change", () => {
    expect(isDailyFilterActive({})).toBe(false);
    expect(isDailyFilterActive({ text: "", category: "all", kind: "all", sort: "date-desc" })).toBe(false);
    expect(isDailyFilterActive({ text: "x" })).toBe(true);
    expect(isDailyFilterActive({ category: "food" })).toBe(true);
    expect(isDailyFilterActive({ sort: "amount-asc" })).toBe(true);
  });
});
