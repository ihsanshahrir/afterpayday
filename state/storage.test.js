import { describe, it, expect, beforeEach } from "vitest";
import { loadState, saveState, importState, STORAGE_KEY, CURRENT_VERSION } from "./storage.js";

beforeEach(() => {
  localStorage.clear();
});

describe("loadState", () => {
  it("returns defaults when storage is empty", () => {
    const s = loadState();
    expect(s.settings.salary).toBe(0);
    expect(s.settings.currency).toBe("RM");
    expect(s.fixedExpenses).toEqual([]);
    expect(s.debtGroups).toEqual([]);
    expect(s.dailyExpenses).toEqual([]);
    expect(s.history).toEqual([]);
    expect(s.currentMonth).toMatch(/^\d{4}-\d{2}$/);
    expect(s._version).toBe(CURRENT_VERSION);
  });

  it("falls back to defaults on corrupt JSON", () => {
    localStorage.setItem(STORAGE_KEY, "{not valid json");
    const s = loadState();
    expect(s.settings.salary).toBe(0);
    expect(Array.isArray(s.dailyExpenses)).toBe(true);
  });

  it("coerces non-array fields to empty arrays", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ fixedExpenses: "oops", debtGroups: 42, dailyExpenses: null })
    );
    const s = loadState();
    expect(s.fixedExpenses).toEqual([]);
    expect(s.debtGroups).toEqual([]);
    expect(s.dailyExpenses).toEqual([]);
  });

  it("round-trips a saved state", () => {
    const original = loadState();
    original.settings.salary = 5000;
    original.dailyExpenses.push({ id: "a", amount: 12, description: "x", date: "2026-01-01", category: "food" });
    expect(saveState(original)).toBe(true);

    const loaded = loadState();
    expect(loaded.settings.salary).toBe(5000);
    expect(loaded.dailyExpenses).toHaveLength(1);
    expect(loaded.dailyExpenses[0].amount).toBe(12);
  });
});

describe("importState", () => {
  it("rejects non-object inputs", () => {
    expect(importState(null)).toBeNull();
    expect(importState(undefined)).toBeNull();
    expect(importState("string")).toBeNull();
    expect(importState(42)).toBeNull();
    expect(importState([1, 2, 3])).toBeNull();
  });

  it("normalises a minimal object into a full valid state", () => {
    const s = importState({});
    expect(s).not.toBeNull();
    expect(s.fixedExpenses).toEqual([]);
    expect(s.debtGroups).toEqual([]);
    expect(s.dailyExpenses).toEqual([]);
    expect(s.history).toEqual([]);
    expect(s.settings.currency).toBe("RM");
    expect(s.currentMonth).toMatch(/^\d{4}-\d{2}$/);
  });

  it("merges settings and coerces bad array fields", () => {
    const s = importState({ settings: { salary: 3200, currency: "USD" }, fixedExpenses: "bad" });
    expect(s.settings.salary).toBe(3200);
    expect(s.settings.currency).toBe("USD");
    expect(s.fixedExpenses).toEqual([]);
  });

  it("preserves valid arrays from a real backup", () => {
    const backup = {
      _version: 1,
      settings: { salary: 1000, currency: "SGD" },
      fixedExpenses: [{ id: "f1", name: "Rent", amount: 800, paidMonth: null }],
      debtGroups: [],
      dailyExpenses: [],
      history: [],
      currentMonth: "2026-05",
    };
    const s = importState(backup);
    expect(s.fixedExpenses).toHaveLength(1);
    expect(s.fixedExpenses[0].name).toBe("Rent");
    expect(s.currentMonth).toBe("2026-05");
  });
});

describe("migration v1 → v2", () => {
  const v1Backup = (overrides = {}) => ({
    _version: 1,
    settings: { salary: 4000, currency: "RM" },
    fixedExpenses: [],
    debtGroups: [],
    dailyExpenses: [],
    history: [],
    currentMonth: "2026-05",
    ...overrides,
  });

  it("migrates a negative-amount daily expense to positive amount with kind refund", () => {
    const s = importState(v1Backup({
      dailyExpenses: [{ id: "d1", amount: -50, description: "return", date: "2026-05-10", category: "refund" }],
    }));
    expect(s.dailyExpenses).toHaveLength(1);
    expect(s.dailyExpenses[0].amount).toBe(50);
    expect(s.dailyExpenses[0].kind).toBe("refund");
  });

  it("stamps kind expense on plain positive expenses", () => {
    const s = importState(v1Backup({
      dailyExpenses: [{ id: "d1", amount: 25, description: "lunch", date: "2026-05-10", category: "food" }],
    }));
    expect(s.dailyExpenses[0].kind).toBe("expense");
    expect(s.dailyExpenses[0].amount).toBe(25);
  });

  it("treats a positive amount with category refund as a refund", () => {
    const s = importState(v1Backup({
      dailyExpenses: [{ id: "d1", amount: 30, description: "", date: "2026-05-10", category: "refund" }],
    }));
    expect(s.dailyExpenses[0].kind).toBe("refund");
    expect(s.dailyExpenses[0].amount).toBe(30);
  });

  it("treats a negative amount with a non-refund category as a refund", () => {
    const s = importState(v1Backup({
      dailyExpenses: [{ id: "d1", amount: -20, description: "", date: "2026-05-10", category: "other" }],
    }));
    expect(s.dailyExpenses[0].kind).toBe("refund");
    expect(s.dailyExpenses[0].amount).toBe(20);
  });

  it("backfills paidMonth null on installments lacking it", () => {
    const s = importState(v1Backup({
      debtGroups: [{
        id: "g1",
        name: "Car",
        installments: [
          { id: "i1", label: "Month 1", amount: 500, dueDate: "2026-01-15", isPaid: true },
          { id: "i2", label: "Month 2", amount: 500, dueDate: "2026-02-15", isPaid: false, paidMonth: null },
        ],
      }],
    }));
    expect(s.debtGroups[0].installments[0].paidMonth).toBeNull();
    expect(s.debtGroups[0].installments[1].paidMonth).toBeNull();
  });

  it("stamps the current version and does not re-migrate a saved v2 state", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v1Backup({
      dailyExpenses: [{ id: "d1", amount: -50, description: "", date: "2026-05-10", category: "refund" }],
    })));
    const migrated = loadState();
    expect(migrated._version).toBe(CURRENT_VERSION);
    expect(migrated.dailyExpenses[0].amount).toBe(50);

    expect(saveState(migrated)).toBe(true);
    const reloaded = loadState();
    expect(reloaded._version).toBe(CURRENT_VERSION);
    // A second load must not flip a refund back or re-abs anything.
    expect(reloaded.dailyExpenses[0].amount).toBe(50);
    expect(reloaded.dailyExpenses[0].kind).toBe("refund");
  });
});

describe("normalizeState validation", () => {
  it("drops daily expenses with non-finite amounts or invalid dates", () => {
    const s = importState({
      _version: 2,
      dailyExpenses: [
        { id: "ok", amount: 10, description: "", date: "2026-05-10", category: "food", kind: "expense" },
        { id: "nan", amount: "abc", description: "", date: "2026-05-10", category: "food", kind: "expense" },
        { id: "inf", amount: Infinity, description: "", date: "2026-05-10", category: "food", kind: "expense" },
        { id: "baddate", amount: 10, description: "", date: "yesterday", category: "food", kind: "expense" },
        { id: "nodate", amount: 10, description: "", category: "food", kind: "expense" },
        "not-an-object",
        null,
      ],
    });
    expect(s.dailyExpenses).toHaveLength(1);
    expect(s.dailyExpenses[0].id).toBe("ok");
  });

  it("drops bad installments and coerces dueDate and isPaid", () => {
    const s = importState({
      _version: 2,
      debtGroups: [{
        id: "g1",
        name: "Loan",
        installments: [
          { id: "ok", label: "M1", amount: 100, dueDate: "2026-05-15", isPaid: 1, paidMonth: "2026-05" },
          { id: "baddue", label: "M2", amount: 100, dueDate: "soon", isPaid: false },
          { id: "badamt", label: "M3", amount: NaN, dueDate: "2026-07-15", isPaid: false },
        ],
      }],
    });
    const insts = s.debtGroups[0].installments;
    expect(insts).toHaveLength(2);
    expect(insts[0].isPaid).toBe(true);
    expect(insts[0].paidMonth).toBe("2026-05");
    expect(insts[1].dueDate).toBeNull();
  });

  it("falls back to RM for unknown currency and keeps known codes", () => {
    expect(importState({ settings: { currency: "XYZ" } }).settings.currency).toBe("RM");
    expect(importState({ settings: { currency: "EUR" } }).settings.currency).toBe("EUR");
  });

  it("coerces non-finite or negative salary to 0", () => {
    expect(importState({ settings: { salary: NaN } }).settings.salary).toBe(0);
    expect(importState({ settings: { salary: -100 } }).settings.salary).toBe(0);
    expect(importState({ settings: { salary: "oops" } }).settings.salary).toBe(0);
  });

  it("drops malformed history entries and keeps valid ones", () => {
    const s = importState({
      _version: 2,
      history: [
        { id: "h1", month: "2026-04", salary: 4000, fixedTotal: 1000, installments: 500, dailySpent: 300, balance: 2200 },
        { id: "h2", month: "April", salary: 4000 },
        { notMonth: true },
        null,
      ],
    });
    expect(s.history).toHaveLength(1);
    expect(s.history[0].month).toBe("2026-04");
  });

  it("replaces a malformed currentMonth with the current month key", () => {
    const s = importState({ _version: 2, currentMonth: "May 2026" });
    expect(s.currentMonth).toMatch(/^\d{4}-\d{2}$/);
  });

  it("assigns ids to entries missing them", () => {
    const s = importState({
      _version: 2,
      dailyExpenses: [{ amount: 10, date: "2026-05-10", category: "food", kind: "expense" }],
    });
    expect(s.dailyExpenses[0].id).toBeTruthy();
  });
});

describe("migration v2 → v3", () => {
  it("resets the stale refund category to other while keeping kind", () => {
    const s = importState({
      _version: 2,
      dailyExpenses: [{ id: "d1", amount: 50, description: "", date: "2026-05-10", category: "refund", kind: "refund" }],
    });
    expect(s.dailyExpenses[0].kind).toBe("refund");
    expect(s.dailyExpenses[0].category).toBe("other");
  });

  it("leaves old rows without a createdAt (does not fabricate one)", () => {
    const s = importState({
      _version: 2,
      dailyExpenses: [{ id: "d1", amount: 10, description: "x", date: "2026-05-10", category: "food", kind: "expense" }],
    });
    expect(s.dailyExpenses[0].createdAt).toBeUndefined();
  });

  it("stamps version 3 on load", () => {
    expect(loadState()._version).toBe(3);
    expect(CURRENT_VERSION).toBe(3);
  });
});

describe("v3 optional fields", () => {
  it("passes through valid createdAt and optional fields, omitting invalid ones", () => {
    const s = importState({
      dailyExpenses: [{
        id: "d1", amount: 10, date: "2026-06-10", category: "food", kind: "expense",
        createdAt: 1_700_000_000_000, merchant: "Cafe", paymentMethod: "card",
        tags: ["work", "work", "", "trip"], note: "  hi  ",
      }],
    });
    const e = s.dailyExpenses[0];
    expect(e.createdAt).toBe(1_700_000_000_000);
    expect(e.merchant).toBe("Cafe");
    expect(e.paymentMethod).toBe("card");
    expect(e.tags).toEqual(["work", "trip"]); // deduped, blanks dropped
    expect(e.note).toBe("hi"); // trimmed
  });

  it("drops an unknown paymentMethod and a non-finite createdAt", () => {
    const s = importState({
      dailyExpenses: [{
        id: "d1", amount: 10, date: "2026-06-10", category: "food", kind: "expense",
        createdAt: "nope", paymentMethod: "bitcoin",
      }],
    });
    const e = s.dailyExpenses[0];
    expect(e.createdAt).toBeUndefined();
    expect(e.paymentMethod).toBeUndefined();
  });
});

describe("settings.categories", () => {
  it("defaults to an empty array", () => {
    expect(loadState().settings.categories).toEqual([]);
  });

  it("keeps valid custom categories, drops invalid and reserved, dedupes ids", () => {
    const s = importState({
      settings: {
        categories: [
          { id: "c1", label: "Groceries", icon: "🛒", color: "var(--amber)", bg: "rgba(1,1,1,0.1)" },
          { id: "c1", label: "Dup id" },          // duplicate id → dropped
          { id: "refund", label: "Nope" },         // reserved → dropped
          { label: "No id" },                       // missing id → dropped
          "not-an-object",
        ],
      },
    });
    expect(s.settings.categories).toHaveLength(1);
    expect(s.settings.categories[0].id).toBe("c1");
    expect(s.settings.categories[0].label).toBe("Groceries");
  });
});
