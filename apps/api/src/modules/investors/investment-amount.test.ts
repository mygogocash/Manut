import { describe, expect, it } from "vitest";

import { parseInvestmentAmount } from "./investment-amount";

describe("parseInvestmentAmount", () => {
  it("parses plain and grouped numbers", () => {
    expect(parseInvestmentAmount("1000000")).toBe(1_000_000);
    expect(parseInvestmentAmount("1,000,000")).toBe(1_000_000);
    expect(parseInvestmentAmount("$500,000")).toBe(500_000);
  });

  it("parses K/M suffixes", () => {
    expect(parseInvestmentAmount("1.5M")).toBe(1_500_000);
    expect(parseInvestmentAmount("$250K")).toBe(250_000);
  });

  it("returns 0 for empty placeholders", () => {
    expect(parseInvestmentAmount(null)).toBe(0);
    expect(parseInvestmentAmount("-")).toBe(0);
    expect(parseInvestmentAmount("TBD")).toBe(0);
    expect(parseInvestmentAmount("n/a")).toBe(0);
  });
});
