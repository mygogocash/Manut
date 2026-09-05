import { describe, expect, it } from "vitest";

import {
  accountFigures,
  rowsForSelection,
  TOTAL_LABEL,
} from "@/app/(dashboard)/marketing-analytics/dau-mau/account-scope";
import { MA_ESTATE_KEY } from "@/services/marketing-analytics.service";

/**
 * Only the slices the cards read. Typing the helper against a `Pick` of the
 * dashboard keeps this fixture the size of the thing under test instead of the
 * whole payload.
 */
const source = {
  lifetime: {
    rows: [
      {
        accountKey: "gopay",
        label: "GoPay",
        totalSessions: 400,
        dauOnAsOf: 40,
      },
      {
        accountKey: "dialog",
        label: "Dialog",
        totalSessions: 100,
        dauOnAsOf: 9,
      },
    ],
    estate: { accountKey: "estate", totalSessions: 500, dauOnAsOf: 49 },
  },
  monthly: [
    {
      month: "2026-07",
      accounts: [{ accountKey: "gopay", mau: 1 }],
      estate: { mau: 2 },
    },
    {
      month: "2026-08",
      accounts: [
        { accountKey: "gopay", mau: 100, capture: 0.01 },
        { accountKey: "dialog", mau: 30, capture: 0.02 },
      ],
      estate: { mau: 130, capture: 0.03 },
    },
  ],
  forecast: {
    estateForecast: 90,
    rows: [
      { accountKey: "gopay", forecastDau: 70 },
      { accountKey: "dialog", forecastDau: 20 },
    ],
  },
  sessions: {
    total: 900,
    previousTotal: 600,
    pctChange: 0.5,
    pacing: [{ date: "2026-08-18", current: 900, previous: 600 }],
    byTelco: [
      {
        accountKey: "gopay",
        total: 700,
        previousTotal: 500,
        pctChange: 0.4,
        pacing: [{ date: "2026-08-18", current: 700, previous: 500 }],
      },
    ],
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

describe("accountFigures", () => {
  it("reads the estate for the combined key, from the latest month", () => {
    const f = accountFigures(source, MA_ESTATE_KEY);
    expect(f.lifetime?.totalSessions).toBe(500);
    expect(f.monthly?.mau).toBe(130);
    expect(f.forecast).toBe(90);
    expect(f.sessions?.total).toBe(900);
  });

  // The regression this guards: every figure used to come from the estate no
  // matter what the Account selector said, so picking a telco changed nothing
  // above the fold.
  it("moves every figure onto the selected account", () => {
    const f = accountFigures(source, "gopay");
    expect(f.lifetime?.totalSessions).toBe(400);
    expect(f.lifetime?.dauOnAsOf).toBe(40);
    expect(f.monthly?.mau).toBe(100);
    expect(f.monthly?.capture).toBe(0.01);
    expect(f.forecast).toBe(70);
    expect(f.sessions?.total).toBe(700);
    expect(f.sessions?.pacing).toEqual([
      { date: "2026-08-18", current: 700, previous: 500 },
    ]);
  });

  // An account with no row for the window must read "—", not the estate's
  // number under that account's name.
  it("returns nothing rather than falling back to the estate", () => {
    const f = accountFigures(source, "dialog");
    expect(f.sessions).toBeUndefined();
    expect(accountFigures(source, "unknown").lifetime).toBeUndefined();
    expect(accountFigures(source, "unknown").monthly).toBeUndefined();
    expect(accountFigures(source, "unknown").forecast).toBeNull();
  });
});

describe("rowsForSelection", () => {
  const rows = [{ accountKey: "a" }, { accountKey: "b" }, { accountKey: "c" }];
  it("keeps every row when nothing is narrowed", () => {
    expect(rowsForSelection(rows, null)).toHaveLength(3);
  });
  it("drops accounts that are not counted, keeping payload order", () => {
    expect(rowsForSelection(rows, ["c", "a"])).toEqual([
      { accountKey: "a" },
      { accountKey: "c" },
    ]);
  });
  // A row for an account excluded from the totals would not sum to the total
  // printed beneath it.
  it("drops a deselected account entirely", () => {
    expect(rowsForSelection(rows, ["a", "b"])).not.toContainEqual({
      accountKey: "c",
    });
  });
});

describe("TOTAL_LABEL", () => {
  // The old label was "Estate (excl. Okara)", accurate only while that
  // exclusion was hardcoded in the API.
  it("names what the figure is, not which account is missing", () => {
    expect(TOTAL_LABEL).toBe("Total");
    expect(TOTAL_LABEL).not.toMatch(/okara|estate/i);
  });
});
