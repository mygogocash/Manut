import { describe, expect, it } from "vitest";

import {
  compareStoredToUpstream,
  crossFootDashboard,
  DRIFT_METRICS,
  driftFingerprint,
  settledWindow,
  type StoredMetricRow,
  type UpstreamSeriesPoint,
} from "@/modules/marketing-analytics/drift/drift.check";

const CLEAN_VALUES = { dauGa: 100, mauRolling30: 3000, homepageViews: 500 };
const CLEAN_METRICS = {
  dau_ga: 100,
  mau_ga: 3000,
  total_views_homepage: 500,
};

function stored(over: Partial<StoredMetricRow> = {}): StoredMetricRow {
  return {
    telco: "dialog",
    date: "2026-08-01",
    isIntraday: false,
    values: { ...CLEAN_VALUES },
    ...over,
  };
}

function upstream(
  over: Partial<UpstreamSeriesPoint> = {},
): UpstreamSeriesPoint {
  return {
    telco: "dialog",
    date: "2026-08-01",
    metrics: { ...CLEAN_METRICS },
    ...over,
  };
}

function run(input: {
  stored: StoredMetricRow[];
  upstream: UpstreamSeriesPoint[];
  dates?: string[];
  telcos?: string[];
}) {
  return compareStoredToUpstream({
    dates: input.dates ?? ["2026-08-01"],
    telcos: input.telcos ?? ["dialog"],
    stored: input.stored,
    upstream: input.upstream,
  });
}

describe("settledWindow", () => {
  it("ends two days before today and spans the requested length", () => {
    const w = settledWindow("2026-08-17", 30, 2);
    expect(w.to).toBe("2026-08-15");
    expect(w.from).toBe("2026-07-17");
    expect(w.dates).toHaveLength(30);
    expect(w.dates[0]).toBe("2026-07-17");
    expect(w.dates.at(-1)).toBe("2026-08-15");
  });

  it("never includes today or yesterday, so a partial day cannot read as drift", () => {
    const w = settledWindow("2026-08-17");
    expect(w.dates).not.toContain("2026-08-17");
    expect(w.dates).not.toContain("2026-08-16");
  });
});

describe("DRIFT_METRICS", () => {
  it("resolves its columns through the ingest mapping", () => {
    expect(DRIFT_METRICS.map((m) => [m.upstream, m.column])).toEqual([
      ["dau_ga", "dauGa"],
      ["mau_ga", "mauRolling30"],
      ["total_views_homepage", "homepageViews"],
    ]);
  });
});

describe("compareStoredToUpstream", () => {
  it("reports nothing when the store matches upstream", () => {
    const r = run({ stored: [stored()], upstream: [upstream()] });
    expect(r.findings).toEqual([]);
    expect(r.comparisons).toBe(3);
    expect(r.silentTelcos).toEqual([]);
  });

  it("flags a day upstream has but the store never ingested", () => {
    const r = run({ stored: [], upstream: [upstream()] });
    expect(r.findings).toHaveLength(1);
    expect(r.findings[0]).toMatchObject({
      kind: "missing_row",
      telco: "dialog",
      date: "2026-08-01",
    });
  });

  it("reports a never-ingested day once, not once per metric", () => {
    const r = run({ stored: [], upstream: [upstream()] });
    expect(r.findings.filter((f) => f.kind === "missing_row")).toHaveLength(1);
  });

  it("flags a settled day still marked intraday, and skips its values", () => {
    const r = run({
      stored: [stored({ isIntraday: true, values: { dauGa: 1 } })],
      upstream: [upstream()],
    });
    expect(r.findings).toHaveLength(1);
    expect(r.findings[0]?.kind).toBe("unsettled_row");
    expect(r.comparisons).toBe(0);
  });

  it("flags a value that disagrees, with the signed delta", () => {
    const r = run({
      stored: [stored({ values: { ...CLEAN_VALUES, dauGa: 90 } })],
      upstream: [upstream()],
    });
    expect(r.findings).toHaveLength(1);
    expect(r.findings[0]).toMatchObject({
      kind: "value_mismatch",
      metric: "dau_ga",
      column: "dauGa",
      stored: 90,
      upstream: 100,
      delta: -10,
    });
    expect(r.findings[0]?.pctDelta).toBeCloseTo(-0.1);
  });

  it("does not divide by zero when upstream reports zero", () => {
    const r = run({
      stored: [stored({ values: { ...CLEAN_VALUES, dauGa: 5 } })],
      upstream: [upstream({ metrics: { ...CLEAN_METRICS, dau_ga: 0 } })],
    });
    expect(r.findings[0]).toMatchObject({ delta: 5, pctDelta: null });
  });

  it("flags a value upstream has and the store is missing", () => {
    const r = run({
      stored: [stored({ values: { ...CLEAN_VALUES, mauRolling30: null } })],
      upstream: [upstream()],
    });
    expect(r.findings).toHaveLength(1);
    expect(r.findings[0]).toMatchObject({
      kind: "missing_value",
      metric: "mau_ga",
      upstream: 3000,
      stored: null,
    });
  });

  it("flags a value we hold that upstream no longer has", () => {
    const r = run({
      stored: [stored()],
      upstream: [
        upstream({ metrics: { dau_ga: 100, total_views_homepage: 500 } }),
      ],
    });
    expect(r.findings).toHaveLength(1);
    expect(r.findings[0]).toMatchObject({
      kind: "orphan_value",
      metric: "mau_ga",
      stored: 3000,
      upstream: null,
    });
  });

  it("treats a telco upstream has no data for as silent, not as 30 missing days", () => {
    const dates = ["2026-08-01", "2026-08-02", "2026-08-03"];
    const r = run({
      dates,
      telcos: ["dialog", "robi"],
      stored: dates.map((date) => stored({ date })),
      upstream: dates.map((date) => upstream({ date })),
    });
    expect(r.silentTelcos).toEqual(["robi"]);
    expect(r.findings).toEqual([]);
  });

  it("does not treat a day neither side has as drift", () => {
    const r = run({
      dates: ["2026-08-01", "2026-08-02"],
      stored: [stored()],
      upstream: [upstream()],
    });
    expect(r.findings).toEqual([]);
  });

  it("does not treat an all-null upstream day as drift", () => {
    const r = run({
      stored: [],
      upstream: [
        upstream({
          metrics: { dau_ga: null, mau_ga: null, total_views_homepage: null },
        }),
      ],
    });
    expect(r.findings).toEqual([]);
  });

  it("ignores rows and points outside the window", () => {
    const r = run({
      dates: ["2026-08-01"],
      stored: [stored({ date: "2026-07-01", values: { dauGa: 1 } })],
      upstream: [upstream(), upstream({ date: "2026-07-01" })],
    });
    expect(r.findings).toHaveLength(1);
    expect(r.findings[0]?.kind).toBe("missing_row");
  });
});

// ── Cross-foot ────────────────────────────────────────────────
const ACCOUNTS = [
  { key: "a", includeInEstate: true },
  { key: "b", includeInEstate: true },
  { key: "okara", includeInEstate: false },
];

function payload(over: Record<string, unknown> = {}) {
  return {
    accounts: ACCOUNTS,
    lifetime: {
      rows: [
        { accountKey: "a", totalSessions: 60, dauOnAsOf: 6, shareOfTotal: 0.6 },
        { accountKey: "b", totalSessions: 40, dauOnAsOf: 4, shareOfTotal: 0.4 },
        {
          accountKey: "okara",
          totalSessions: 999,
          dauOnAsOf: 99,
          shareOfTotal: 9.99,
        },
      ],
      estate: { totalSessions: 100, dauOnAsOf: 10 },
    },
    sessions: {
      total: 30,
      previousTotal: 12,
      pacing: [
        { current: 10, previous: 4 },
        { current: 20, previous: 8 },
      ],
      byTelco: [
        { accountKey: "a", total: 18 },
        { accountKey: "b", total: 12 },
        { accountKey: "okara", total: 500 },
      ],
    },
    ...over,
  };
}

describe("crossFootDashboard", () => {
  it("passes a consistent payload and excludes non-estate accounts", () => {
    const r = crossFootDashboard(payload());
    expect(r.findings).toEqual([]);
    expect(r.checks).toBe(6);
  });

  it("catches an estate lifetime total that disagrees with its rows", () => {
    const p = payload();
    p.lifetime.estate.totalSessions = 120;
    const r = crossFootDashboard(p);
    expect(r.findings.map((f) => f.check)).toContain(
      "lifetime.estate.totalSessions",
    );
    expect(r.findings[0]).toMatchObject({ reported: 120, recomputed: 100 });
  });

  it("catches a sessions total that disagrees with the pacing series", () => {
    const p = payload();
    p.sessions.pacing = [
      { current: 10, previous: 4 },
      { current: 19, previous: 8 },
    ];
    const r = crossFootDashboard(p);
    expect(r.findings.map((f) => f.check)).toContain("sessions.total.vsPacing");
  });

  it("catches a sessions total that disagrees with its per-telco totals", () => {
    const p = payload();
    p.sessions.byTelco = [
      { accountKey: "a", total: 18 },
      { accountKey: "b", total: 11 },
      { accountKey: "okara", total: 500 },
    ];
    const r = crossFootDashboard(p);
    expect(r.findings.map((f) => f.check)).toContain(
      "sessions.total.vsByTelco",
    );
  });

  it("catches shares that do not close on 100%", () => {
    const p = payload();
    p.lifetime.rows[1]!.shareOfTotal = 0.3;
    const r = crossFootDashboard(p);
    expect(r.findings.map((f) => f.check)).toContain("lifetime.shareOfTotal");
  });

  it("treats a total present on one side only as a finding", () => {
    const p = payload();
    p.lifetime.estate.dauOnAsOf = null;
    const r = crossFootDashboard(p);
    expect(r.findings.map((f) => f.check)).toContain(
      "lifetime.estate.dauOnAsOf",
    );
  });

  it("stays quiet on an empty dataset rather than inventing drift", () => {
    const r = crossFootDashboard({
      accounts: ACCOUNTS,
      lifetime: {
        rows: [
          {
            accountKey: "a",
            totalSessions: null,
            dauOnAsOf: null,
            shareOfTotal: null,
          },
        ],
        estate: { totalSessions: null, dauOnAsOf: null },
      },
      sessions: {
        total: null,
        previousTotal: null,
        pacing: [],
        byTelco: [],
      },
    });
    expect(r.findings).toEqual([]);
  });
});

describe("driftFingerprint", () => {
  it("is 'clean' when nothing drifted", () => {
    expect(driftFingerprint({ store: [], crossFoot: [] })).toBe("clean");
  });

  it("is stable regardless of finding order", () => {
    const a = {
      kind: "missing_row" as const,
      telco: "dialog",
      date: "2026-08-01",
      stored: null,
      upstream: null,
      delta: null,
      pctDelta: null,
    };
    const b = { ...a, telco: "robi" };
    expect(driftFingerprint({ store: [a, b], crossFoot: [] })).toBe(
      driftFingerprint({ store: [b, a], crossFoot: [] }),
    );
  });

  it("ignores magnitude so a permanent restatement cannot re-alert daily", () => {
    const base = {
      kind: "value_mismatch" as const,
      telco: "dialog",
      date: "2026-08-01",
      metric: "dau_ga",
      column: "dauGa",
      upstream: 100,
      delta: -10,
      pctDelta: -0.1,
    };
    expect(
      driftFingerprint({ store: [{ ...base, stored: 90 }], crossFoot: [] }),
    ).toBe(
      driftFingerprint({ store: [{ ...base, stored: 80 }], crossFoot: [] }),
    );
  });

  it("changes when a new day drifts, so a widening problem re-alerts", () => {
    const one = {
      kind: "missing_row" as const,
      telco: "dialog",
      date: "2026-08-01",
      stored: null,
      upstream: null,
      delta: null,
      pctDelta: null,
    };
    const two = { ...one, date: "2026-08-02" };
    expect(driftFingerprint({ store: [one], crossFoot: [] })).not.toBe(
      driftFingerprint({ store: [one, two], crossFoot: [] }),
    );
  });
});
