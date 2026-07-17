import { describe, expect, it } from "vitest";

import { formatCurrency, normaliseCurrencyCode } from "@/lib/format-currency";

describe("normaliseCurrencyCode", () => {
  it("maps known symbols to ISO codes", () => {
    expect(normaliseCurrencyCode("₹")).toBe("INR");
    expect(normaliseCurrencyCode("฿")).toBe("THB");
    expect(normaliseCurrencyCode("$")).toBe("USD");
    expect(normaliseCurrencyCode("€")).toBe("EUR");
  });

  it("upper-cases plain three-letter codes", () => {
    expect(normaliseCurrencyCode("usd")).toBe("USD");
    expect(normaliseCurrencyCode("thb")).toBe("THB");
    expect(normaliseCurrencyCode("INR")).toBe("INR");
  });

  it("returns null for inputs that aren't currencies", () => {
    expect(normaliseCurrencyCode("")).toBeNull();
    expect(normaliseCurrencyCode(null)).toBeNull();
    expect(normaliseCurrencyCode("garbage")).toBeNull();
    expect(normaliseCurrencyCode("U.S.")).toBeNull();
  });
});

describe("formatCurrency", () => {
  it("does not throw on the rupee glyph (regression: white-screen bug)", () => {
    expect(() => formatCurrency(1234.5, "₹")).not.toThrow();
    const out = formatCurrency(1234.5, "₹");
    expect(out).toMatch(/1,234\.50/);
  });

  it("formats valid ISO codes via Intl.NumberFormat", () => {
    expect(formatCurrency(1234.5, "INR")).toMatch(/1,234\.50/);
    expect(formatCurrency(1234.5, "THB")).toMatch(/1,234\.50/);
  });

  it("falls back to plain '<raw> <amount>' on unknown currency", () => {
    const out = formatCurrency(50, "XX");
    expect(out).toContain("50");
    expect(out).toContain("XX");
  });

  it("treats string amounts the same as numeric ones", () => {
    expect(formatCurrency("99.99", "USD")).toEqual(
      formatCurrency(99.99, "USD"),
    );
  });

  it("coerces non-finite amounts to zero rather than rendering NaN", () => {
    const out = formatCurrency(Number.NaN, "USD");
    expect(out).toMatch(/0\.00/);
  });
});
