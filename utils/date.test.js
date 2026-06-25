import { describe, it, expect } from "vitest";
import {
  todayISO,
  currentMonthKey,
  isInCurrentMonth,
  isFixedPaidThisMonth,
  isOverdue,
  fmtDate,
  fmtRelativeDay,
  fmtTime,
} from "./date.js";

const iso = (d) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

describe("date keys", () => {
  it("currentMonthKey is YYYY-MM", () => {
    expect(currentMonthKey()).toMatch(/^\d{4}-\d{2}$/);
  });

  it("todayISO is YYYY-MM-DD and starts with the current month", () => {
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(todayISO().startsWith(currentMonthKey())).toBe(true);
  });
});

describe("isInCurrentMonth", () => {
  it("matches today's month and rejects others / empty", () => {
    expect(isInCurrentMonth(todayISO())).toBe(true);
    expect(isInCurrentMonth("1999-01-01")).toBe(false);
    expect(isInCurrentMonth(null)).toBe(false);
    expect(isInCurrentMonth(undefined)).toBe(false);
    expect(isInCurrentMonth("")).toBe(false);
  });
});

describe("isFixedPaidThisMonth", () => {
  it("is true only when paidMonth equals the current month key", () => {
    expect(isFixedPaidThisMonth({ paidMonth: currentMonthKey() })).toBe(true);
    expect(isFixedPaidThisMonth({ paidMonth: "2000-01" })).toBe(false);
    expect(isFixedPaidThisMonth({ paidMonth: null })).toBe(false);
  });
});

describe("isOverdue", () => {
  it("flags past dates only; today and future are not overdue", () => {
    const yesterday = new Date(Date.now() - 86_400_000);
    const tomorrow = new Date(Date.now() + 86_400_000);
    expect(isOverdue(iso(yesterday))).toBe(true);
    expect(isOverdue(todayISO())).toBe(false);
    expect(isOverdue(iso(tomorrow))).toBe(false);
    expect(isOverdue(null)).toBe(false);
  });
});

describe("fmtDate", () => {
  it("returns empty string for falsy input", () => {
    expect(fmtDate("")).toBe("");
    expect(fmtDate(null)).toBe("");
  });

  it("includes the year for a valid ISO date", () => {
    expect(fmtDate("2026-01-12")).toMatch(/2026/);
  });
});

describe("fmtRelativeDay", () => {
  it("labels today and yesterday, and falls back to the full date", () => {
    const yesterday = new Date(Date.now() - 86_400_000);
    expect(fmtRelativeDay(todayISO())).toBe("Today");
    expect(fmtRelativeDay(iso(yesterday))).toBe("Yesterday");
    expect(fmtRelativeDay("1999-01-01")).toMatch(/1999/);
    expect(fmtRelativeDay("")).toBe("");
    expect(fmtRelativeDay(null)).toBe("");
  });
});

describe("fmtTime", () => {
  it("returns a non-empty time string for a valid timestamp and empty for missing", () => {
    expect(fmtTime(new Date(2026, 0, 1, 14, 32).getTime())).toMatch(/\d/);
    expect(fmtTime(undefined)).toBe("");
    expect(fmtTime(NaN)).toBe("");
  });
});
