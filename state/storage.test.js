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
