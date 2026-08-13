import { describe, it, expect } from "vitest";
import {
  normalizeMoney,
  parseAmount,
  parseDate,
  parseMerchant,
  guessCategory,
  parseReceiptText,
} from "./receiptParse.js";

describe("normalizeMoney", () => {
  it("handles dot-decimal, comma-thousands, and comma-decimal", () => {
    expect(normalizeMoney("45.00")).toBe(45);
    expect(normalizeMoney("1,234.56")).toBe(1234.56);
    expect(normalizeMoney("1.234,56")).toBe(1234.56);
    expect(normalizeMoney("12,50")).toBe(12.5);
    expect(normalizeMoney("45000.00")).toBe(45000);
    expect(normalizeMoney("RM 99.90")).toBe(99.9);
  });

  it("returns null for non-numeric input", () => {
    expect(normalizeMoney("")).toBe(null);
    expect(normalizeMoney("abc")).toBe(null);
    expect(normalizeMoney(null)).toBe(null);
  });
});

describe("parseAmount", () => {
  it("prefers the TOTAL line even when CHANGE is larger", () => {
    const text = [
      "SUBTOTAL      22.40",
      "ROUNDING       0.00",
      "TOTAL         22.40",
      "CASH          50.00",
      "CHANGE        27.60",
    ].join("\n");
    expect(parseAmount(text)).toBe(22.4);
  });

  it("reads 'Amount Due' and thousands separators", () => {
    expect(parseAmount("Amount Due  RM 1,899.00")).toBe(1899);
    expect(parseAmount("JUMLAH        100.00")).toBe(100);
  });

  it("falls back to the largest price when no total keyword exists", () => {
    const text = "Cappuccino 3,50\nCroissant 2,80\nSumme 6,30";
    expect(parseAmount(text)).toBe(6.3);
  });

  it("ignores dates and returns null when there is no price", () => {
    expect(parseAmount("Visit us 31.12.2026\nThank you")).toBe(null);
    expect(parseAmount("")).toBe(null);
  });
});

describe("parseDate", () => {
  it("parses ISO and day-first numeric dates", () => {
    expect(parseDate("Date 2026-06-20")).toBe("2026-06-20");
    expect(parseDate("12/06/2026 14:32")).toBe("2026-06-12");
    expect(parseDate("20-06-2026")).toBe("2026-06-20");
  });

  it("swaps to month-first only when the first field cannot be a day", () => {
    expect(parseDate("06/20/2026")).toBe("2026-06-20");
    expect(parseDate("06/07/2026")).toBe("2026-07-06"); // ambiguous → day-first
  });

  it("parses textual months", () => {
    expect(parseDate("12 Jun 2026")).toBe("2026-06-12");
    expect(parseDate("Jun 12, 2026")).toBe("2026-06-12");
  });

  it("returns null for invalid or missing dates", () => {
    expect(parseDate("32/13/2026")).toBe(null);
    expect(parseDate("no date here")).toBe(null);
    expect(parseDate("")).toBe(null);
  });
});

describe("parseMerchant", () => {
  it("takes the first name-like header line and title-cases all-caps", () => {
    expect(parseMerchant("PETRONAS\nNO 12 JALAN ABC\nTEL: 03-123")).toBe("Petronas");
    expect(parseMerchant("Cafe Mocha\nRechnung\nCappuccino 3,50")).toBe("Cafe Mocha");
  });

  it("skips invoice/contact lines and pure-number lines", () => {
    expect(parseMerchant("TAX INVOICE\n2026-06-20\nAEON BIG")).toBe("Aeon Big");
  });

  it("returns empty string when nothing looks like a name", () => {
    expect(parseMerchant("")).toBe("");
    expect(parseMerchant("@@@ ###\n123456")).toBe("");
  });

  it("strips a leading formula-trigger character (CSV injection guard)", () => {
    expect(parseMerchant("=SUM Grocer\nTEL: 03-123")).toBe("SUM Grocer");
    expect(parseMerchant("+CMD Store\nTEL: 03-123")).toBe("CMD Store");
    expect(parseMerchant("-Evil Mart\nTEL: 03-123")).toBe("Evil Mart");
  });
});

describe("guessCategory", () => {
  it("maps merchants to fuel / food / shop", () => {
    expect(guessCategory("Petronas")).toBe("fuel");
    expect(guessCategory("Cafe Mocha")).toBe("food");
    expect(guessCategory("Tesco Stores")).toBe("shop");
  });

  it("falls back to body text, then to 'other'", () => {
    expect(guessCategory("", "Pump 3 Diesel 25L")).toBe("fuel");
    expect(guessCategory("Unknown Vendor", "misc items")).toBe("other");
  });
});

describe("parseReceiptText (end to end)", () => {
  it("extracts all four fields from a petrol receipt", () => {
    const text = [
      "PETRONAS",
      "STESEN MINYAK SDN BHD",
      "TEL: 03-12345678",
      "PUMP 03 PETROL PRIMAX 95",
      "LITRES        25.00",
      "TOTAL RM     100.00",
      "CASH         100.00",
      "CHANGE         0.00",
      "12/06/2026 14:32",
      "THANK YOU",
    ].join("\n");
    expect(parseReceiptText(text)).toEqual({
      amount: 100,
      description: "Petronas",
      category: "fuel",
      date: "2026-06-12",
    });
  });

  it("returns safe empties for unreadable text", () => {
    expect(parseReceiptText("")).toEqual({
      amount: null,
      description: "",
      category: "other",
      date: null,
    });
  });
});
