import { describe, expect, it } from "vitest";

import { parseBusinessUnitCell } from "@/components/crm/business-unit-import";

const KNOWN = [
  { code: "onewave", label: "Onewave" },
  { code: "onewave-revenue", label: "Onewave Revenue" },
  { code: "aria", label: "ARIA" },
];

describe("parseBusinessUnitCell", () => {
  it("round-trips the codes the export writes", () => {
    expect(parseBusinessUnitCell("onewave, aria", KNOWN)).toEqual({
      codes: ["onewave", "aria"],
      unknown: [],
    });
  });

  it("resolves the labels a human would type", () => {
    expect(parseBusinessUnitCell("Onewave Revenue, aria", KNOWN).codes).toEqual(
      ["onewave-revenue", "aria"],
    );
  });

  it("is case-insensitive on both codes and labels", () => {
    expect(parseBusinessUnitCell("ONEWAVE, Aria", KNOWN).codes).toEqual([
      "onewave",
      "aria",
    ]);
  });

  it("reports unknown tokens instead of dropping them silently", () => {
    const result = parseBusinessUnitCell("onewave, Atlantis", KNOWN);
    expect(result.codes).toEqual(["onewave"]);
    expect(result.unknown).toEqual(["Atlantis"]);
  });

  it("dedupes repeated mentions, keeping the first", () => {
    expect(
      parseBusinessUnitCell("aria, ARIA, Onewave, aria", KNOWN).codes,
    ).toEqual(["aria", "onewave"]);
  });

  it("treats an empty, whitespace, or missing cell as no tags", () => {
    expect(parseBusinessUnitCell("", KNOWN)).toEqual({
      codes: [],
      unknown: [],
    });
    expect(parseBusinessUnitCell("  , ,", KNOWN)).toEqual({
      codes: [],
      unknown: [],
    });
    expect(parseBusinessUnitCell(undefined, KNOWN)).toEqual({
      codes: [],
      unknown: [],
    });
  });

  it("reports everything as unknown before the unit list has loaded", () => {
    expect(parseBusinessUnitCell("onewave", [])).toEqual({
      codes: [],
      unknown: ["onewave"],
    });
  });
});
