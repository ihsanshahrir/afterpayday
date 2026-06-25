import { describe, it, expect } from "vitest";
import { toDailyCSV } from "./csv.js";

describe("toDailyCSV", () => {
  it("emits a header row even for no data", () => {
    const csv = toDailyCSV([]);
    expect(csv.split("\r\n")).toHaveLength(1);
    expect(csv).toMatch(/^date,time,kind,category,amount,/);
  });

  it("emits one row per expense with kind and category", () => {
    const csv = toDailyCSV([
      { date: "2026-06-10", amount: 12.5, kind: "expense", category: "food", description: "Lunch" },
      { date: "2026-06-11", amount: 5, kind: "refund", category: "shop", description: "Return" },
    ]);
    const rows = csv.split("\r\n");
    expect(rows).toHaveLength(3);
    expect(rows[1]).toContain("expense");
    expect(rows[1]).toContain("food");
    expect(rows[2]).toContain("refund");
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
