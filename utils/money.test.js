import { describe, it, expect } from "vitest";
import { fmtNum, splitEvenly } from "./money.js";

describe("fmtNum", () => {
  it("renders two decimal places", () => {
    expect(fmtNum(0)).toBe(fmtNum(0)); // stable
    expect(fmtNum(5)).toMatch(/5[.,]00$/);
  });

  it("treats non-finite input as zero", () => {
    expect(fmtNum(NaN)).toBe(fmtNum(0));
    expect(fmtNum(Infinity)).toBe(fmtNum(0));
    expect(fmtNum(undefined)).toBe(fmtNum(0));
  });
});

describe("splitEvenly", () => {
  it("returns n parts that sum back to the total exactly", () => {
    const parts = splitEvenly(100, 3);
    expect(parts).toHaveLength(3);
    const sum = parts.reduce((a, b) => a + b, 0);
    expect(+sum.toFixed(2)).toBe(100);
  });

  it("absorbs the remainder in the last part", () => {
    expect(splitEvenly(100, 3)).toEqual([33.33, 33.33, 33.34]);
  });

  it("divides evenly when there is no remainder", () => {
    expect(splitEvenly(90, 3)).toEqual([30, 30, 30]);
  });

  it("handles a single installment", () => {
    expect(splitEvenly(49.99, 1)).toEqual([49.99]);
  });

  it("never drifts across many installments", () => {
    const parts = splitEvenly(1000, 7);
    expect(parts).toHaveLength(7);
    expect(+parts.reduce((a, b) => a + b, 0).toFixed(2)).toBe(1000);
  });

  it("rejects invalid inputs", () => {
    expect(splitEvenly(100, 0)).toEqual([]);
    expect(splitEvenly(100, -2)).toEqual([]);
    expect(splitEvenly(100, 2.5)).toEqual([]);
    expect(splitEvenly(NaN, 3)).toEqual([]);
  });
});
