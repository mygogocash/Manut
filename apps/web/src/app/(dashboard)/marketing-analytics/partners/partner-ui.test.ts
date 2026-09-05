import { describe, expect, it } from "vitest";

import {
  compactNumber,
  flagFor,
  formatFieldValue,
  formatMetricValue,
  SOURCE_BADGE,
  SOURCE_FILTERS,
} from "./partner-ui";

describe("compactNumber", () => {
  // The precision changes with magnitude and the difference is visible in the
  // operator console: millions carry two decimals, thousands carry one.
  it("gives millions TWO decimals", () => {
    expect(compactNumber(3_390_000)).toBe("3.39M");
    expect(compactNumber(3_394_000)).toBe("3.39M");
  });

  it("gives thousands ONE decimal", () => {
    expect(compactNumber(322_600)).toBe("322.6K");
    expect(compactNumber(158_000)).toBe("158.0K");
    // 4000 must read 4.0K, not 4K — a bare "4K" looks like a different figure.
    expect(compactNumber(4000)).toBe("4.0K");
  });

  it("gives billions two decimals", () => {
    expect(compactNumber(2_500_000_000)).toBe("2.50B");
  });

  it("leaves sub-thousand values alone, to at most one decimal", () => {
    expect(compactNumber(38)).toBe("38");
    expect(compactNumber(80.75)).toBe("80.8");
    expect(compactNumber(0.2)).toBe("0.2");
  });

  it("handles negatives on the same rules", () => {
    expect(compactNumber(-16_850)).toBe("-16.9K");
  });

  it("returns the em dash for non-finite input", () => {
    expect(compactNumber(Number.NaN)).toBe("—");
    expect(compactNumber(Number.POSITIVE_INFINITY)).toBe("—");
  });
});

describe("formatFieldValue", () => {
  it("renders a missing headline as an em dash, not zero", () => {
    // A field with no upstream data must never read "0" — that is a claim.
    expect(formatFieldValue(null)).toBe("—");
  });

  it("matches the operator console's raw-data figures", () => {
    expect(formatFieldValue(322_600)).toBe("322.6K");
    expect(formatFieldValue(3_390_000)).toBe("3.39M");
    expect(formatFieldValue(80.8)).toBe("80.8");
  });
});

describe("formatMetricValue", () => {
  it("formats percentages and percentage points to one decimal", () => {
    expect(formatMetricValue(79.69, "%")).toBe("79.7%");
    expect(formatMetricValue(2.03, "pp")).toBe("2.0 pp");
  });

  it("rounds seconds and days rather than showing decimals", () => {
    expect(formatMetricValue(217.8, "s")).toBe("218s");
    expect(formatMetricValue(3.6, "days")).toBe("4d");
  });

  it("keeps one decimal for minutes", () => {
    expect(formatMetricValue(3.64, "min")).toBe("3.6 min");
  });

  it("compacts hours", () => {
    expect(formatMetricValue(12_500, "hours")).toBe("12.5K h");
  });

  it("compacts unitless values at or above 1000", () => {
    // A3 reads 1.1K in the console, not 1,106.
    expect(formatMetricValue(1106, "")).toBe("1.1K");
    expect(formatMetricValue(3473, "")).toBe("3.5K");
  });

  it("keeps small unitless values exact, to two decimals", () => {
    expect(formatMetricValue(153, "")).toBe("153");
    expect(formatMetricValue(-12.5, "")).toBe("-12.50");
  });

  it("renders no-data as an em dash", () => {
    expect(formatMetricValue(null, "%")).toBe("—");
    expect(formatMetricValue(Number.NaN, "")).toBe("—");
  });
});

describe("presentation maps", () => {
  it("has a badge style for every filterable source", () => {
    for (const f of SOURCE_FILTERS) {
      if (f.value === "all") continue;
      expect(SOURCE_BADGE).toHaveProperty(f.value);
    }
  });

  it("covers every country in the configured partner set", () => {
    for (const country of [
      "Sri Lanka",
      "Indonesia",
      "Bangladesh",
      "Pakistan",
      "Myanmar",
    ]) {
      expect(flagFor(country)).not.toBe("");
    }
  });

  it("degrades to an empty string for an unknown or missing country", () => {
    expect(flagFor("Atlantis")).toBe("");
    expect(flagFor(null)).toBe("");
    expect(flagFor(undefined)).toBe("");
  });
});
