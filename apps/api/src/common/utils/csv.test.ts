import { describe, expect, it } from "vitest";

import { csvCell, neutralizeFormula, rowsToCsv } from "@/common/utils/csv";

describe("neutralizeFormula", () => {
  it("prefixes a quote to string cells that open a formula", () => {
    expect(neutralizeFormula("=1+1")).toBe("'=1+1");
    expect(neutralizeFormula("+44")).toBe("'+44");
    expect(neutralizeFormula("-cmd")).toBe("'-cmd");
    expect(neutralizeFormula("@SUM(A1)")).toBe("'@SUM(A1)");
  });

  it("leaves safe strings and non-string values untouched", () => {
    expect(neutralizeFormula("Jane Doe")).toBe("Jane Doe");
    // Negative numbers stay numeric — only string cells are guarded.
    expect(neutralizeFormula(-5)).toBe(-5);
    expect(neutralizeFormula(120)).toBe(120);
    expect(neutralizeFormula(null)).toBeNull();
  });
});

describe("csvCell", () => {
  it("neutralizes a formula-injecting name and RFC-quotes it", () => {
    // Leading quote added, then the cell is RFC-quoted (no comma/quote here,
    // so just the leading-quote guard applies).
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
  });

  it("does not corrupt a numeric cell", () => {
    expect(csvCell(-5)).toBe("-5");
  });
});

describe("rowsToCsv", () => {
  it("escapes a formula cell within a row", () => {
    const out = rowsToCsv(["Name"], [["=2+2"]]);
    expect(out).toContain("'=2+2");
  });
});
