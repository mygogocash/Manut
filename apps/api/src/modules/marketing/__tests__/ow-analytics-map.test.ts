import { describe, expect, it } from "vitest";

import {
  ACCESS_PASS_METRIC,
  API_CORE_TO_KEY,
  type ApiPartnerResult,
  buildMetricRequestList,
  mapResultsToRows,
  parsePartnerMap,
  synthesizeRawTabs,
  TX_FIELDS,
} from "../ow-analytics-map";

describe("parsePartnerMap", () => {
  it("parses slug:uuid pairs and rejects unknown slugs", () => {
    const { byUuid, warnings } = parsePartnerMap(
      "gopay:u1, dialog:u2 ,bogus:u3",
    );
    expect(byUuid.get("u1")).toBe("gopay");
    expect(byUuid.get("u2")).toBe("dialog");
    expect(byUuid.has("u3")).toBe(false);
    expect(warnings.some((w) => w.includes("bogus"))).toBe(true);
  });
  it("treats undefined/blank as 'no override' — not an error", () => {
    // Unset used to mean "API disabled" and warranted a warning. It now means
    // "use the built-in partner registry", which is the normal path, so an
    // empty value must stay quiet — a warning here would cry wolf on every run.
    expect(parsePartnerMap(undefined).byUuid.size).toBe(0);
    expect(parsePartnerMap(undefined).warnings).toEqual([]);
    expect(parsePartnerMap("").warnings).toEqual([]);
  });
  it("warns on malformed entries", () => {
    const { byUuid, warnings } = parsePartnerMap("gopay:u1,garbage");
    expect(byUuid.size).toBe(1);
    expect(warnings.some((w) => w.includes("garbage"))).toBe(true);
  });
});

describe("buildMetricRequestList", () => {
  it("includes 23 core keys, the access-pass tx key, and tx.<type>.<field>", () => {
    const list = buildMetricRequestList(["purchase"], TX_FIELDS);
    expect(Object.keys(API_CORE_TO_KEY).every((k) => list.includes(k))).toBe(
      true,
    );
    expect(list).toContain(ACCESS_PASS_METRIC);
    expect(list).toContain("tx.purchase.amount");
    expect(list).toContain("tx.purchase.count");
    expect(new Set(list).size).toBe(list.length); // deduped
  });
});

describe("mapResultsToRows", () => {
  const byUuid = new Map([["u1", "gopay" as const]]);
  const results: ApiPartnerResult[] = [
    {
      partner_id: "u1",
      telco_name: "GoPay",
      series: [
        {
          date: "2026-05-12",
          metrics: {
            dau: 100,
            total_bnry_tokens_earned: 5000000000, // > Int32
            avg_time_spent_seconds: 42.7,
            "tx.use_pass.unique_users": 12,
            "tx.purchase.amount": 900,
            unique_users: null,
          },
        },
      ],
    },
  ];
  it("maps core metrics, rounds durations, buckets by partner_id", () => {
    const { rows } = mapResultsToRows(results, byUuid);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.telco).toBe("gopay");
    expect(rows[0]!.values.dauCrm).toBe(100);
    expect(rows[0]!.values.bnryEarned).toBe(5000000000);
    expect(rows[0]!.values.avgSessionSec).toBe(43); // rounded
    expect(rows[0]!.values.accessPassUsers).toBe(12); // from tx.use_pass.unique_users
    expect(rows[0]!.values.stwWins).toBeUndefined(); // no source
  });
  it("captures tx.* into txMetrics and skips null values", () => {
    const { rows } = mapResultsToRows(results, byUuid);
    expect(rows[0]!.txMetrics!["tx.purchase.amount"]).toBe(900);
    expect(rows[0]!.values.uniqueUsers).toBeUndefined(); // null skipped
    expect(rows[0]!.sourceTab).toBe("analytics-api");
    expect(rows[0]!.isIntraday).toBe(false);
  });
  it("warns and skips a partner_id not in the map", () => {
    const { rows, warnings } = mapResultsToRows(
      [{ ...results[0]!, partner_id: "unknown" }],
      byUuid,
    );
    expect(rows).toHaveLength(0);
    expect(warnings.some((w) => w.includes("unknown"))).toBe(true);
  });
  it("skips a point with an invalid/malformed date and warns, keeping the valid one", () => {
    const mixed: ApiPartnerResult[] = [
      {
        partner_id: "u1",
        telco_name: "GoPay",
        series: [
          { date: "2026-05-12", metrics: { dau: 100 } },
          { date: "not-a-date", metrics: { dau: 200 } },
        ],
      },
    ];
    const { rows, warnings } = mapResultsToRows(mixed, byUuid);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.date).toBe("2026-05-12");
    expect(
      warnings.some(
        (w) => w.includes("not-a-date") && w.includes("invalid date"),
      ),
    ).toBe(true);
  });
});

describe("synthesizeRawTabs", () => {
  it("produces one grid per telco with a date column", () => {
    const results: ApiPartnerResult[] = [
      {
        partner_id: "u1",
        telco_name: "GoPay",
        series: [{ date: "2026-05-12", metrics: { dau: 100 } }],
      },
    ];
    const { rows } = mapResultsToRows(
      results,
      new Map([["u1", "gopay" as const]]),
    );
    const tabs = synthesizeRawTabs(rows);
    expect(tabs).toHaveLength(1);
    expect(tabs[0]!.telco).toBe("gopay");
    expect(tabs[0]!.headers[0]).toBe("date");
    expect(tabs[0]!.rows[0]![0]).toBe("2026-05-12");
  });
});
