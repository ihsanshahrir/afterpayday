import { describe, it, expect } from "vitest";
import { toDailyCSV } from "./csv.js";

describe("toDailyCSV", () => {
  it("emits a header row even for no data", () => {
    const csv = toDailyCSV([]);
    expect(csv.split("\r\n")).toHaveLength(1);
    expect(csv).toMatch(/^date,time,kind,category,amount,/);
  });

  it("emits one row per expense with kind and category label", () => {
    const csv = toDailyCSV([
      { date: "2026-06-10", amount: 12.5, kind: "expense", category: "food", description: "Lunch" },
      { date: "2026-06-11", amount: 5, kind: "refund", category: "shop", description: "Return" },
    ]);
    const rows = csv.split("\r\n");
    expect(rows).toHaveLength(3);
    expect(rows[1]).toContain("expense");
    expect(rows[1]).toContain("Food");
    expect(rows[2]).toContain("refund");
  });

  it("resolves custom-category ids to their user-entered label", () => {
    const custom = [{ id: "c-abc123", label: "Groceries", icon: "🛒", color: "var(--amber)" }];
    const csv = toDailyCSV(
      [{ date: "2026-06-10", amount: 9, kind: "expense", category: "c-abc123", description: "Milk" }],
      custom,
    );
    const row = csv.split("\r\n")[1];
    expect(row).toContain("Groceries");
    expect(row).not.toContain("c-abc123");
  });

  it("falls back to the default label for unknown/missing category ids", () => {
    const csv = toDailyCSV([
      { date: "2026-06-10", amount: 1, kind: "expense", category: "c-deleted", description: "x" },
      { date: "2026-06-11", amount: 2, kind: "expense", description: "y" },
    ]);
    const rows = csv.split("\r\n");
    expect(rows[1]).toContain("Other");
    expect(rows[2]).toContain("Other");
  });

  it("escapes commas, quotes and newlines per RFC-4180", () => {
    const csv = toDailyCSV([
      { date: "2026-06-10", amount: 1, kind: "expense", category: "other", description: 'a,b "c"' },
    ]);
    expect(csv).toContain('"a,b ""c"""');
  });

  it("serialises tags joined with a pipe", () => {
    const csv = toDailyCSV([
      { date: "2026-06-10", amount: 1, kind: "expense", category: "food", tags: ["work", "trip"] },
    ]);
    expect(csv).toContain("work|trip");
  });
});
