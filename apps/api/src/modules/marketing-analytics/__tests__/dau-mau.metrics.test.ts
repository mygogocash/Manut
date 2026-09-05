import { describe, expect, it } from "vitest";

import {
  type AccountConfig,
  buildIndex,
  computeDashboard,
  computeSessions,
  type DauPoint,
  ESTATE_KEY,
  estateSourceOf,
  forecast,
  growth,
  lifetime,
  mean,
  monthlyRollup,
  ratio,
  resolveSessionsWindow,
  rolling3Day,
  type SessionsPoint,
  sum,
  TOTAL_LABEL,
  trends,
  weeklyGrowth,
  windowDates,
} from "@/modules/marketing-analytics/dau-mau.metrics";

// Small helpers to build fixtures.
function acct(
  key: string,
  accessibleMau: number | null,
  includeInEstate = true,
  sortOrder = 0,
): AccountConfig {
  return {
    key,
    label: key.toUpperCase(),
    accessibleMau,
    includeInEstate,
    sortOrder,
  };
}
function p(
  accountKey: string,
  date: string,
  dau: number | null,
  isCampaignDay = false,
): DauPoint {
  return { accountKey, date, dau, isCampaignDay };
}

describe("numeric helpers — blank ≠ zero", () => {
  it("mean ignores blanks (does not count them as 0)", () => {
    expect(mean([100, null, 200])).toBe(150);
    expect(mean([null, undefined])).toBeNull();
  });
  it("sum ignores blanks and is null when nothing is present", () => {
    expect(sum([1, null, 2])).toBe(3);
    expect(sum([null, null])).toBeNull();
  });
  it("ratio / growth return null on an empty or zero denominator", () => {
    expect(ratio(5, 0)).toBeNull();
    expect(ratio(5, null)).toBeNull();
    expect(ratio(300, 1000)).toBe(0.3);
    expect(growth(10, 0)).toBeNull();
    expect(growth(150, 100)).toBeCloseTo(0.5, 6);
  });
});

describe("trend windows — the dates the UI labels each figure with", () => {
  it("windowDates walks the same days windowSeries averages, oldest first", () => {
    expect(windowDates("2026-06-14", 3)).toEqual([
      "2026-06-12",
      "2026-06-13",
      "2026-06-14",
    ]);
    // Crosses a month boundary rather than clamping inside June.
    expect(windowDates("2026-06-01", 3)).toEqual([
      "2026-05-30",
      "2026-05-31",
      "2026-06-01",
    ]);
  });

  it("reports the 3-day window, the 28-day baseline and the prev-month baseline", () => {
    const points = [
      p("a", "2026-06-12", 100),
      p("a", "2026-06-13", 200),
      p("a", "2026-06-14", 300),
    ];
    const row = trends(buildIndex(points), "a").find(
      (r) => r.date === "2026-06-14",
    )!;
    expect(row.threeDayAvg).toBe(200);
    expect(row.threeDayWindow).toEqual([
      "2026-06-12",
      "2026-06-13",
      "2026-06-14",
    ]);
    expect(row.vs28DaysBackDate).toBe("2026-05-17");
    expect(row.vsPrevMonthDate).toBe("2026-05-14");
  });

  it("still names both baselines on a row whose comparisons are null", () => {
    // Only one day of data: every window is incomplete, but the dates the
    // comparison *would* use are still defined, so the tooltip can say so.
    const row = trends(buildIndex([p("a", "2026-06-14", 300)]), "a").find(
      (r) => r.date === "2026-06-14",
    )!;
    expect(row.threeDayAvg).toBeNull();
    expect(row.vs28DaysBack).toBeNull();
    expect(row.vsPrevMonthSameDate).toBeNull();
    expect(row.threeDayWindow).toHaveLength(3);
    expect(row.vs28DaysBackDate).toBe("2026-05-17");
    expect(row.vsPrevMonthDate).toBe("2026-05-14");
  });

  it("clamps the prev-month baseline into a shorter month", () => {
    // 31 May has no counterpart in April, so the baseline is 30 Apr — the
    // case the tooltip copy has to be careful about.
    const row = trends(buildIndex([p("a", "2026-05-31", 100)]), "a").find(
      (r) => r.date === "2026-05-31",
    )!;
    expect(row.vsPrevMonthDate).toBe("2026-04-30");
  });
});

describe("monthly MAU + capture + month-end forecast", () => {
  it("sums only entered days; capture = MAU / accessible; forecast scales by days-in-month", () => {
    const accounts = [acct("a", 1000)];
    const points = [
      p("a", "2026-07-01", 100),
      p("a", "2026-07-02", 200),
      p("a", "2026-07-03", null), // blank — ignored
    ];
    const [block] = monthlyRollup(buildIndex(points), accounts);
    const cell = block!.accounts.find((c) => c.accountKey === "a")!;
    expect(cell.mau).toBe(300);
    expect(cell.daysEntered).toBe(2);
    expect(cell.capture).toBeCloseTo(0.3, 6);
    // 300 over 2 entered days, 31-day month → 4650.
    expect(cell.monthEndForecast).toBeCloseTo(4650, 4);
  });

  it("reproduces the workbook's Aug month-end forecast (127,940 / 9 × 31 ≈ 440,682)", () => {
    const accounts = [acct("tsel", 9_000_000)];
    // 9 entered August days summing to 127,940 (the workbook's Aug-so-far MAU).
    const daily = [9558, 8017, 5451, 5390, 37197, 38428, 14244, 3877, 5778];
    expect(daily.reduce((a, b) => a + b, 0)).toBe(127940);
    const points = daily.map((v, i) => p("tsel", `2026-08-0${i + 1}`, v));
    const block = monthlyRollup(buildIndex(points), accounts)[0]!;
    const cell = block.accounts[0]!;
    expect(cell.mau).toBe(127940);
    expect(cell.monthEndForecast).toBeCloseTo(440682.22, 1);
    // Workbook Telkomsel June capture 193,719 / 9,000,000 = 0.0215243.
    expect(ratio(193719, 9_000_000)).toBeCloseTo(0.021524, 6);
  });

  it("capture is null when the account has no accessible base", () => {
    const accounts = [acct("a", null)];
    const block = monthlyRollup(
      buildIndex([p("a", "2026-06-01", 500)]),
      accounts,
    )[0]!;
    expect(block.accounts[0]!.capture).toBeNull();
  });
});

describe("rolling 3-day (workbook: Telkomsel as-of 2026-08-09)", () => {
  it("last-3 vs prior-3 mean, %-change and direction", () => {
    const accounts = [acct("tsel", 9_000_000)];
    const points = [
      p("tsel", "2026-08-04", 5390),
      p("tsel", "2026-08-05", 37197),
      p("tsel", "2026-08-06", 38428),
      p("tsel", "2026-08-07", 14244),
      p("tsel", "2026-08-08", 3877),
      p("tsel", "2026-08-09", 5778),
    ];
    const { rows } = rolling3Day(buildIndex(points), accounts, "2026-08-09");
    const r = rows[0]!;
    expect(r.last3Avg).toBeCloseTo(7966.333, 2); // (14244+3877+5778)/3
    expect(r.prior3Avg).toBeCloseTo(27005, 2); // (5390+37197+38428)/3
    expect(r.pctChange).toBeCloseTo(-0.705, 3);
    expect(r.direction).toBe("down");
  });
});

describe("next-day forecast (baseline × uplift, 3-tick floor)", () => {
  const accounts = [acct("x", null)];

  it("holds uplift at 1.00× with fewer than 3 ticked days", () => {
    const points = [
      p("x", "2026-08-01", 1000),
      p("x", "2026-08-02", 1000),
      p("x", "2026-08-03", 1000),
      p("x", "2026-08-05", 2000, true), // 2 ticked days — too few
      p("x", "2026-08-06", 2000, true),
      p("x", "2026-08-10", null, true), // forecast date, ticked
    ];
    const { rows } = forecast(buildIndex(points), accounts, "2026-08-10");
    const r = rows[0]!;
    expect(r.tickedDays).toBe(2);
    expect(r.uplift).toBe(1);
    // ticked forecast day but held → baseline × 1 = baseline (1000).
    expect(r.forecastDau).toBeCloseTo(1000, 6);
    expect(r.basis).toMatch(/held/i);
  });

  it("prices a ticked forecast day at the campaign-day average once ≥3 ticks", () => {
    const points = [
      p("x", "2026-08-01", 1000),
      p("x", "2026-08-02", 1000),
      p("x", "2026-08-03", 1000),
      p("x", "2026-08-05", 2000, true),
      p("x", "2026-08-06", 2000, true),
      p("x", "2026-08-07", 3000, true), // 3 ticks, avg 2333.33
      p("x", "2026-08-10", null, true), // forecast date, ticked
    ];
    const { rows } = forecast(buildIndex(points), accounts, "2026-08-10");
    const r = rows[0]!;
    expect(r.organicBaseline).toBeCloseTo(1000, 6);
    expect(r.campaignAvg).toBeCloseTo(2333.333, 2);
    expect(r.uplift).toBeCloseTo(2.3333, 3);
    // baseline × uplift == campaignAvg on a ticked day.
    expect(r.forecastDau).toBeCloseTo(2333.333, 2);
  });

  it("an unticked forecast day forecasts the organic baseline", () => {
    const points = [
      p("x", "2026-08-01", 1000),
      p("x", "2026-08-02", 1200),
      p("x", "2026-08-05", 3000, true),
      p("x", "2026-08-06", 3000, true),
      p("x", "2026-08-07", 3000, true),
    ];
    const { rows } = forecast(buildIndex(points), accounts, "2026-08-10");
    const r = rows[0]!;
    expect(r.tickedOnForecastDate).toBe(false);
    expect(r.forecastDau).toBeCloseTo(1100, 6); // mean(1000,1200)
  });
});

describe("estate = headline series if present, else sum of include-in-estate", () => {
  const accounts = [
    acct("a", 100, true, 10),
    acct("b", 200, true, 20),
    acct("okara", null, false, 30), // excluded
  ];

  it("falls back to the sum of tracked accounts and reports zero unattributed", () => {
    const points = [
      p("a", "2026-06-01", 100),
      p("b", "2026-06-01", 200),
      p("okara", "2026-06-01", 50), // must NOT enter the estate total
    ];
    const block = monthlyRollup(buildIndex(points), accounts)[0]!;
    expect(block.sumOfAccounts).toBe(300);
    expect(block.estate.mau).toBe(300);
    expect(block.unattributed).toBe(0);
  });

  it("uses the entered estate headline and reports the unattributed gap", () => {
    const points = [
      p("a", "2026-06-01", 100),
      p("b", "2026-06-01", 200),
      p("estate", "2026-06-01", 500), // headline larger than the sum
    ];
    const block = monthlyRollup(buildIndex(points), accounts)[0]!;
    expect(block.sumOfAccounts).toBe(300);
    expect(block.estate.mau).toBe(500);
    expect(block.unattributed).toBe(200);
  });
});

describe("lifetime share + blank handling", () => {
  it("share of total = account total / estate total; averages skip blanks", () => {
    const accounts = [acct("a", 100, true, 10), acct("b", 100, true, 20)];
    const points = [
      p("a", "2026-06-01", 100),
      p("a", "2026-06-02", null), // blank
      p("b", "2026-06-01", 300),
      p("b", "2026-06-02", 100),
    ];
    const { rows, estate } = lifetime(
      buildIndex(points),
      accounts,
      "2026-06-02",
    );
    const a = rows.find((r) => r.accountKey === "a")!;
    expect(a.totalSessions).toBe(100);
    expect(a.averageSessions).toBe(100); // 100 over 1 entered day, not /2
    expect(estate.totalSessions).toBe(500); // 100 + 400
    expect(a.shareOfTotal).toBeCloseTo(0.2, 6);
  });
});

describe("weekly growth (Mon–Sun)", () => {
  it("buckets Mon–Sun, counts campaign days, and lists accounts running", () => {
    const accounts = [acct("a", 100, true, 10)];
    // 2026-06-01 is a Monday.
    const points = [
      p("a", "2026-06-01", 100, true),
      p("a", "2026-06-02", 200),
      p("a", "2026-06-08", 300), // next week (Monday)
    ];
    const weeks = weeklyGrowth(buildIndex(points), accounts);
    expect(weeks).toHaveLength(2);
    expect(weeks[0]!.weekStart).toBe("2026-06-01");
    expect(weeks[0]!.accounts[0]!.weeklyDau).toBe(300);
    expect(weeks[0]!.campaignAccountDays).toBe(1);
    expect(weeks[0]!.accountsRunning).toBe(1);
    expect(weeks[1]!.accounts[0]!.weeklyDau).toBe(300);
    expect(weeks[1]!.accounts[0]!.vsPrevWeek).toBe(0); // 300 vs 300
  });
});

describe("computeSessions (Telco Reports headline)", () => {
  const accounts = [
    acct("a", null, true, 10),
    acct("b", null, true, 20),
    acct("okara", null, false, 30), // excluded from estate
  ];
  const sp = (
    accountKey: string,
    date: string,
    sessions: number | null,
  ): SessionsPoint => ({
    accountKey,
    date,
    sessions,
  });
  // windowDays=2, asOf=2026-08-10 → current [08-09,08-10], prior [08-07,08-08].
  const points = [
    sp("a", "2026-08-07", 100),
    sp("a", "2026-08-08", 100),
    sp("a", "2026-08-09", 200),
    sp("a", "2026-08-10", 200),
    sp("b", "2026-08-07", 50),
    sp("b", "2026-08-08", 50),
    sp("b", "2026-08-09", 50),
    sp("b", "2026-08-10", 50),
    // Okara must NOT enter estate totals even though it has big numbers.
    sp("okara", "2026-08-09", 9999),
    sp("okara", "2026-08-10", 9999),
  ];
  const s = computeSessions(points, accounts, "2026-08-10", 2);

  it("estate total = sum of include-in-estate accounts over the window; excludes Okara", () => {
    expect(s.total).toBe(500); // (200+50)+(200+50)
    expect(s.previousTotal).toBe(300); // (100+50)+(100+50)
    expect(s.pctChange).toBeCloseTo(0.6667, 3);
  });
  it("pacing aligns each current day with the same offset in the prior window", () => {
    expect(s.pacing).toHaveLength(2);
    expect(s.pacing[0]).toEqual({
      date: "2026-08-09",
      current: 250,
      previous: 150,
    });
    expect(s.pacing[1]).toEqual({
      date: "2026-08-10",
      current: 250,
      previous: 150,
    });
  });
  it("per-telco totals + growth", () => {
    const a = s.byTelco.find((t) => t.accountKey === "a")!;
    expect(a.total).toBe(400);
    expect(a.previousTotal).toBe(200);
    expect(a.pctChange).toBeCloseTo(1.0, 6);
    const b = s.byTelco.find((t) => t.accountKey === "b")!;
    expect(b.pctChange).toBe(0);
  });
  // The dashboard's Account selector draws this chart, so a per-telco series
  // has to be day-aligned the same way the estate one is — and hold only that
  // telco's days, never the estate sum under a telco's name.
  it("per-telco pacing is day-aligned and holds that telco alone", () => {
    const a = s.byTelco.find((t) => t.accountKey === "a")!;
    expect(a.pacing).toEqual([
      { date: "2026-08-09", current: 200, previous: 100 },
      { date: "2026-08-10", current: 200, previous: 100 },
    ]);
    // Okara is out of the estate but still an account you can select.
    const okara = s.byTelco.find((t) => t.accountKey === "okara")!;
    expect(okara.pacing.map((p) => p.current)).toEqual([9999, 9999]);
    expect(okara.pacing.map((p) => p.previous)).toEqual([null, null]);
    // Every series covers the same days as the estate series.
    for (const t of s.byTelco) {
      expect(t.pacing.map((p) => p.date)).toEqual(s.pacing.map((p) => p.date));
    }
  });
});

// Regression: the Sessions exhibit used to be pinned to 28 days ending at the
// last fetched date, so the page's date picker changed only what was fetched
// and never the figure's window. Picking 1–16 Aug produced a card titled
// "last 28 days" holding the 16 days that happened to exist, with no
// comparison — and neither half announced itself, because `sum` skips absent
// days rather than failing.
describe("resolveSessionsWindow (the date picker drives the exhibit)", () => {
  it("keeps the 28-day exhibit when no range is picked", () => {
    const w = resolveSessionsWindow({
      requestedFrom: undefined,
      dateFrom: "2026-04-19",
      dateTo: "2026-08-16",
    });
    // The default 120-day fetch already reaches back past the prior 28 days,
    // so nothing needs extending.
    expect(w).toEqual({
      windowDays: 28,
      fetchFrom: "2026-04-19",
      extended: false,
    });
  });

  it("adopts the picked range as the window, inclusive of both ends", () => {
    const w = resolveSessionsWindow({
      requestedFrom: "2026-08-01",
      dateFrom: "2026-08-01",
      dateTo: "2026-08-16",
    });
    expect(w.windowDays).toBe(16);
  });

  it("extends the fetch one window back so the comparison has a baseline", () => {
    const w = resolveSessionsWindow({
      requestedFrom: "2026-08-01",
      dateFrom: "2026-08-01",
      dateTo: "2026-08-16",
    });
    expect(w.fetchFrom).toBe("2026-07-16");
    expect(w.extended).toBe(true);
  });

  it("handles a single-day range", () => {
    const w = resolveSessionsWindow({
      requestedFrom: "2026-08-16",
      dateFrom: "2026-08-16",
      dateTo: "2026-08-16",
    });
    expect(w.windowDays).toBe(1);
    expect(w.fetchFrom).toBe("2026-08-15");
  });

  it("drops the pre-roll past the comparison cap rather than doubling a huge query", () => {
    const w = resolveSessionsWindow({
      requestedFrom: "2025-08-16",
      dateFrom: "2025-08-16",
      dateTo: "2026-08-16",
      maxComparisonDays: 180,
    });
    expect(w.windowDays).toBe(366);
    expect(w.extended).toBe(false);
    // No baseline fetched → the exhibit reports "—" rather than a total
    // summed from a partly-loaded window.
    expect(w.fetchFrom).toBe("2025-08-16");
  });

  it("is unaffected by a dateTo-only request", () => {
    const w = resolveSessionsWindow({
      requestedFrom: null,
      dateFrom: "2026-04-19",
      dateTo: "2026-08-10",
    });
    expect(w.windowDays).toBe(28);
    expect(w.extended).toBe(false);
  });
});

describe("computeSessions honours a picked window end to end", () => {
  const accounts = [acct("a", null, true, 10), acct("okara", null, false, 20)];
  // 1–16 Aug picked; the pre-roll (16–31 Jul) is fetched only as the baseline.
  const points: SessionsPoint[] = [];
  for (let d = 16; d <= 31; d++) {
    points.push({
      accountKey: "a",
      date: `2026-07-${String(d).padStart(2, "0")}`,
      sessions: 100,
    });
  }
  for (let d = 1; d <= 16; d++) {
    points.push({
      accountKey: "a",
      date: `2026-08-${String(d).padStart(2, "0")}`,
      sessions: 200,
    });
  }

  it("sums exactly the picked range and compares against the pre-roll", () => {
    const s = computeSessions(points, accounts, "2026-08-16", 16);
    expect(s.windowDays).toBe(16);
    expect(s.total).toBe(3200); // 16 × 200
    expect(s.previousTotal).toBe(1600); // 16 × 100
    expect(s.pctChange).toBeCloseTo(1.0, 6);
    expect(s.pacing).toHaveLength(16);
    expect(s.pacing.every((p) => p.current !== null)).toBe(true);
  });

  it("without the pre-roll the comparison is null, never a partial total", () => {
    const rangeOnly = points.filter((p) => p.date >= "2026-08-01");
    const s = computeSessions(rangeOnly, accounts, "2026-08-16", 16);
    expect(s.total).toBe(3200);
    expect(s.previousTotal).toBeNull();
    expect(s.pctChange).toBeNull();
  });

  it("the old fixed 28-day window is what produced the mislabelled figure", () => {
    const rangeOnly = points.filter((p) => p.date >= "2026-08-01");
    const s = computeSessions(rangeOnly, accounts, "2026-08-16", 28);
    // Same 3200, but presented as "last 28 days" over a 28-slot pacing series
    // that is 12 days empty — the bug this change removes.
    expect(s.total).toBe(3200);
    expect(s.pacing).toHaveLength(28);
    expect(s.pacing.filter((p) => p.current === null)).toHaveLength(12);
  });
});

// ── Membership is the caller's choice ───────────────────────────
//
// `includeInEstate` used to be `!/okara/i.test(name)` in the service: the only
// set of accounts that could be totalled was the one compiled in. These pin the
// behaviour the selector depends on — that the totals follow the flags, and that
// the reserved estate key never becomes a member of its own total.
describe("totals follow the selected accounts", () => {
  const points = [
    p("a", "2026-08-01", 100),
    p("a", "2026-08-02", 100),
    p("b", "2026-08-01", 10),
    p("b", "2026-08-02", 10),
    p("c", "2026-08-01", 1),
    p("c", "2026-08-02", 1),
  ];

  const dashboardFor = (members: string[]) =>
    computeDashboard({
      points,
      accounts: [
        acct("a", 1_000, members.includes("a"), 0),
        acct("b", 2_000, members.includes("b"), 1),
        acct("c", 4_000, members.includes("c"), 2),
      ],
      campaigns: [],
    });

  it("counts every account when all three are members", () => {
    const d = dashboardFor(["a", "b", "c"]);
    expect(d.lifetime.estate.totalSessions).toBe(222);
  });

  it("drops a deselected account from the total", () => {
    const d = dashboardFor(["a", "b"]);
    expect(d.lifetime.estate.totalSessions).toBe(220);
  });

  it("totals a single selected account as itself", () => {
    const d = dashboardFor(["b"]);
    expect(d.lifetime.estate.totalSessions).toBe(20);
    expect(d.lifetime.estate.dauOnAsOf).toBe(10);
  });

  // Capture divides by the accessible MAU of the accounts counted, so the
  // denominator has to move with the selection too.
  it("moves the capture denominator with the selection", () => {
    const all = dashboardFor(["a", "b", "c"]);
    const some = dashboardFor(["a"]);
    const augAll = all.monthly.find((m) => m.month === "2026-08")!;
    const augSome = some.monthly.find((m) => m.month === "2026-08")!;
    expect(augAll.sumOfAccounts).toBe(222);
    expect(augSome.sumOfAccounts).toBe(200);
    expect(augSome.estate.capture).not.toBe(augAll.estate.capture);
  });

  it("still labels the total row without naming any excluded account", () => {
    const d = dashboardFor(["a"]);
    expect(d.lifetime.estate.label).toBe(TOTAL_LABEL);
    expect(d.lifetime.estate.label).not.toMatch(/okara/i);
  });

  it("never counts the reserved estate key as a member of its own total", () => {
    const d = computeDashboard({
      points: [...points, p(ESTATE_KEY, "2026-08-01", 9_999)],
      accounts: [
        acct("a", 1_000, true, 0),
        // Even flagged in, the reserved key is the total, not a row in it.
        acct(ESTATE_KEY, null, true, 9),
      ],
      campaigns: [],
    });
    expect(d.lifetime.rows.map((r) => r.accountKey)).not.toContain(ESTATE_KEY);
  });
});

describe("estateSourceOf", () => {
  const accounts = [acct("a", null, true, 0)];

  it('reads "sum" when BNII entered no estate series', () => {
    const idx = buildIndex([p("a", "2026-08-01", 5)]);
    expect(estateSourceOf(idx)).toBe("sum");
    expect(
      computeDashboard({
        points: [p("a", "2026-08-01", 5)],
        accounts,
        campaigns: [],
      }).estateSource,
    ).toBe("sum");
  });

  // When it IS entered the figure exceeds the sum — the gap is unattributed
  // traffic BNII does not break out — so the page must not present it as the
  // total over a selection.
  it('reads "reported" when an estate series is present', () => {
    const idx = buildIndex([
      p("a", "2026-08-01", 5),
      p(ESTATE_KEY, "2026-08-01", 40),
    ]);
    expect(estateSourceOf(idx)).toBe("reported");
  });
});
