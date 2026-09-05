import { describe, expect, it } from "vitest";

import { ATLAS_METRIC_CATEGORIES, ATLAS_METRICS } from "../atlas/atlas-metrics";
import { evaluateFormula, type SeriesLookup } from "../atlas/metric-formula";

/** 1..n ascending, so slopes and window offsets are easy to reason about. */
function ramp(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i + 1);
}

function lookupOf(series: Record<string, number[]>): SeriesLookup {
  return (id) => series[id] ?? null;
}

const BASIC = lookupOf({
  dau_ga: [10, 20, 30],
  new_users_ga: [1, 2, 3],
  repeated_users_ga: [4, 5, 6],
  zeros: [0, 0, 0],
  flat: [7, 7, 7, 7],
  ramp30: ramp(30),
});

describe("references and indexing", () => {
  it("reads a bare identifier as the most recent day", () => {
    expect(evaluateFormula("dau_ga", BASIC)).toBe(30);
  });

  it("walks back with [t-k] and treats [t] as today", () => {
    expect(evaluateFormula("dau_ga[t]", BASIC)).toBe(30);
    expect(evaluateFormula("dau_ga[t-1]", BASIC)).toBe(20);
    expect(evaluateFormula("dau_ga[t-2]", BASIC)).toBe(10);
  });

  it("returns no-data when the offset runs off the start of history", () => {
    expect(evaluateFormula("dau_ga[t-3]", BASIC)).toBeNull();
  });

  it("returns no-data for an unknown field", () => {
    expect(evaluateFormula("not_a_field", BASIC)).toBeNull();
  });
});

describe("arithmetic", () => {
  it("honours precedence and parentheses", () => {
    expect(evaluateFormula("new_users_ga + repeated_users_ga * 2", BASIC)).toBe(
      15,
    );
    expect(
      evaluateFormula("(new_users_ga + repeated_users_ga) * 2", BASIC),
    ).toBe(18);
  });

  it("supports unary minus", () => {
    expect(evaluateFormula("-dau_ga", BASIC)).toBe(-30);
  });

  it("refuses division by zero rather than returning Infinity", () => {
    expect(evaluateFormula("dau_ga / zeros", BASIC)).toBeNull();
  });
});

describe("window functions", () => {
  it("sums a window ending today", () => {
    expect(evaluateFormula("sum(ramp30, 7d)", BASIC)).toBe(
      24 + 25 + 26 + 27 + 28 + 29 + 30,
    );
  });

  it("shifts the window END with the third argument", () => {
    // The 7 days before the last 7 — this is what A6 uses for WoW growth.
    expect(evaluateFormula("sum(ramp30, 7d, t-7)", BASIC)).toBe(
      17 + 18 + 19 + 20 + 21 + 22 + 23,
    );
  });

  it("defaults to the whole series when no window is given", () => {
    expect(evaluateFormula("sum(dau_ga)", BASIC)).toBe(60);
  });

  it("treats avg and mean as the same function", () => {
    expect(evaluateFormula("avg(dau_ga)", BASIC)).toBe(20);
    expect(evaluateFormula("mean(dau_ga)", BASIC)).toBe(20);
  });

  it("computes min and max", () => {
    expect(evaluateFormula("min(dau_ga)", BASIC)).toBe(10);
    expect(evaluateFormula("max(dau_ga)", BASIC)).toBe(30);
  });

  it("uses SAMPLE stdev (n-1), not population", () => {
    // [10,20,30]: population sd is 8.165, sample sd is 10.
    expect(evaluateFormula("stdev(dau_ga)", BASIC)).toBe(10);
  });

  it("computes an OLS slope", () => {
    expect(evaluateFormula("linear_slope(dau_ga)", BASIC)).toBe(10);
  });

  it("computes a z-score of the latest day", () => {
    expect(evaluateFormula("z_score(dau_ga)", BASIC)).toBe(1);
  });

  it("refuses a z-score when the series is flat (sd would be 0)", () => {
    expect(evaluateFormula("z_score(flat)", BASIC)).toBeNull();
  });

  it("refuses a window longer than the available history", () => {
    expect(evaluateFormula("sum(dau_ga, 30d)", BASIC)).toBeNull();
  });

  it("refuses `all` — cumulative-since-launch history is partial", () => {
    expect(evaluateFormula("sum(dau_ga, all)", BASIC)).toBeNull();
  });

  it("refuses an unknown function name", () => {
    expect(evaluateFormula("median(dau_ga, 7d)", BASIC)).toBeNull();
  });
});

describe("prose formulas are refused, not guessed at", () => {
  // These are real catalog entries. Atlas leaves them in and shows "no data";
  // the danger would be a parser that silently evaluated a PREFIX of them.
  it.each([
    "count(sources where earn_share >= 10%)",
    "count(features used by >=5% DAU) / total_features * 100",
    "0.4*band(G2) + 0.3*band(F7) + 0.2*band(G9) + 0.1*band(J3)",
    "weighted(M1 + D7 + J3 + F8 + H10)",
    "= J8",
  ])("refuses %s", (formula) => {
    expect(evaluateFormula(formula, BASIC)).toBeNull();
  });

  it("does not evaluate a truncated prefix of a prose formula", () => {
    // `dau_ga where x > 1` must be null, NOT 30 from the leading identifier.
    expect(evaluateFormula("dau_ga where x > 1", BASIC)).toBeNull();
  });
});

describe("real catalog formulas", () => {
  const lookup = lookupOf({
    new_users_ga: ramp(30),
    repeated_users_ga: ramp(30).map((v) => v * 2),
    dau_ga: ramp(30).map((v) => v * 10),
    mau_d30: ramp(30).map((v) => v * 100),
  });
  const byId = (id: string) =>
    ATLAS_METRICS.find((m) => m.id === id)?.formula ?? "";

  it("A2 · New User Share", () => {
    // new_users_ga / dau_ga * 100 → 30 / 300 * 100
    expect(evaluateFormula(byId("A2"), lookup)).toBeCloseTo(10, 6);
  });

  it("A5 · Day-over-Day New User Growth", () => {
    // (30 - 29) / 29 * 100
    expect(evaluateFormula(byId("A5"), lookup)).toBeCloseTo((1 / 29) * 100, 6);
  });

  it("A6 · Week-over-Week New User Growth", () => {
    const last7 = 24 + 25 + 26 + 27 + 28 + 29 + 30;
    const prev7 = 17 + 18 + 19 + 20 + 21 + 22 + 23;
    expect(evaluateFormula(byId("A6"), lookup)).toBeCloseTo(
      ((last7 - prev7) / prev7) * 100,
      6,
    );
  });

  it("A8 · Acquisition Acceleration is a positive slope on a rising series", () => {
    expect(evaluateFormula(byId("A8"), lookup)).toBeCloseTo(1, 6);
  });

  it("B4 · DAU/MAU Stickiness", () => {
    // dau_ga / mau_d30 * 100 → 300 / 3000 * 100
    expect(evaluateFormula(byId("B4"), lookup)).toBeCloseTo(10, 6);
  });

  it("A7 is no-data when the denominator series is missing", () => {
    // Mirrors the real Bima case where category A shows 7 of 8 metrics.
    const noRepeat = lookupOf({ new_users_ga: ramp(30) });
    expect(evaluateFormula(byId("A7"), noRepeat)).toBeNull();
  });
});

describe("catalog integrity", () => {
  it("has 166 metrics across 16 categories", () => {
    expect(ATLAS_METRICS).toHaveLength(166);
    expect(ATLAS_METRIC_CATEGORIES).toHaveLength(16);
  });

  it("assigns every metric to a declared category", () => {
    const ids = new Set(ATLAS_METRIC_CATEGORIES.map((c) => c.id));
    for (const m of ATLAS_METRICS) expect(ids.has(m.category)).toBe(true);
  });

  it("has unique metric ids", () => {
    expect(new Set(ATLAS_METRICS.map((m) => m.id)).size).toBe(
      ATLAS_METRICS.length,
    );
  });

  it("never throws on any catalog formula, however malformed", () => {
    // The whole catalog must degrade to null, never crash a request.
    for (const m of ATLAS_METRICS) {
      expect(() => evaluateFormula(m.formula, BASIC)).not.toThrow();
    }
  });
});
