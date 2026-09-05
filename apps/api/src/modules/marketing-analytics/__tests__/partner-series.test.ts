import { describe, expect, it } from "vitest";

import {
  ATLAS_RAW_FIELDS,
  FIELD_BY_ID,
  requiredUpstreamKeys,
  shownRawFields,
} from "../atlas/atlas-fields";
import {
  buildPartnerSeries,
  type DailyPoint,
  headline,
  roundHeadline,
} from "../atlas/partner-series";

function day(date: string, metrics: Record<string, number | null>): DailyPoint {
  return { date, metrics };
}

/** Look up a shown field by the FIELD ID the table displays (its Atlas name). */
function field(fieldId: string) {
  const f = shownRawFields().find((x) => x.bnii === fieldId);
  if (!f) throw new Error(`no shown field ${fieldId}`);
  return f;
}

describe("registry integrity", () => {
  it("shows 31 of 39 fields, matching Atlas's !idx && !hide filter", () => {
    expect(ATLAS_RAW_FIELDS).toHaveLength(39);
    expect(shownRawFields()).toHaveLength(31);
  });

  it("gives every shown field at least one upstream key", () => {
    for (const f of shownRawFields()) {
      expect(f.upstream.length).toBeGreaterThan(0);
    }
  });

  it("needs 31 distinct upstream keys — above the 30-metric query cap", () => {
    // This is precisely why loadPartnerDaily chunks the request.
    expect(requiredUpstreamKeys()).toHaveLength(31);
  });

  it("keeps the canonical id and the displayed field id distinct where Atlas does", () => {
    // The classic bug: mau_d30 is the CANONICAL id, `mau` is what Atlas shows,
    // and mau_ga is the upstream key that actually feeds it.
    const mau = FIELD_BY_ID.get("mau_d30");
    expect(mau?.bnii).toBe("mau");
    expect(mau?.upstream).toEqual(["mau_ga"]);
    expect(mau?.agg).toBe("last");
    expect(mau?.label).toBe("Monthly Active Users (30d)");
  });

  it("derives unique_users from dau_ga and headlines it as a SUM", () => {
    const uu = field("unique_users");
    expect(uu.upstream).toEqual(["dau_ga"]);
    expect(uu.agg).toBe("sum");
    expect(uu.note).toBe("Dau GA sum");
    // dau_ga is the same daily series, headlined as an average instead.
    expect(field("dau_ga").agg).toBe("avg");
  });

  it("sums the video earn field from its two upstream keys", () => {
    expect(field("bnry_earned_video").upstream).toEqual([
      "tx.FOLLOW_GIVEN.amount",
      "tx.LIKE_GIVEN.amount",
    ]);
  });

  it("marks the negative-debit keys absolute", () => {
    expect(field("bnry_redeemed").abs).toBe(true);
    expect(field("bnry_redeemed").upstream).toEqual(["total_debit"]);
  });
});

describe("buildPartnerSeries", () => {
  const points = [
    day("2026-08-01", { dau_ga: 100, mau_ga: 900, total_debit: -50 }),
    day("2026-08-02", { dau_ga: 200, mau_ga: 950, total_debit: -70 }),
  ];

  it("keys series by the ATLAS field name, not the upstream key", () => {
    const s = buildPartnerSeries(points);
    // BNII `mau_ga` lands under Atlas's `mau`.
    expect(s.mau).toEqual([900, 950]);
    expect(s.mau_ga).toBeUndefined();
  });

  it("feeds two fields from one upstream key when Atlas aliases it", () => {
    const s = buildPartnerSeries(points);
    expect(s.unique_users).toEqual([100, 200]);
    expect(s.dau_ga).toEqual([100, 200]);
  });

  it("takes the absolute value of negative debits", () => {
    expect(buildPartnerSeries(points).bnry_redeemed).toEqual([50, 70]);
  });

  it("sums a multi-key field, counting a day that reports only one key", () => {
    const s = buildPartnerSeries([
      day("2026-08-01", {
        "tx.FOLLOW_GIVEN.amount": 10,
        "tx.LIKE_GIVEN.amount": 5,
      }),
      day("2026-08-02", { "tx.FOLLOW_GIVEN.amount": 7 }),
    ]);
    expect(s.bnry_earned_video).toEqual([15, 7]);
  });

  it("sorts by date — upstream order is not guaranteed", () => {
    const s = buildPartnerSeries([
      day("2026-08-03", { dau_ga: 3 }),
      day("2026-08-01", { dau_ga: 1 }),
      day("2026-08-02", { dau_ga: 2 }),
    ]);
    expect(s.dau_ga).toEqual([1, 2, 3]);
  });

  it("omits days that reported nothing rather than inserting zeros", () => {
    const s = buildPartnerSeries([
      day("2026-08-01", { dau_ga: 10 }),
      day("2026-08-02", { dau_ga: null }),
      day("2026-08-03", { dau_ga: 30 }),
    ]);
    expect(s.dau_ga).toEqual([10, 30]);
  });

  it("omits a field entirely when nothing reported", () => {
    expect(buildPartnerSeries([day("2026-08-01", {})]).dau_ga).toBeUndefined();
  });
});

describe("headline", () => {
  it("sums flows, averages rates, and takes the last day for stocks", () => {
    expect(headline([1, 2, 3], "sum")).toBe(6);
    expect(headline([1, 2, 3], "avg")).toBe(2);
    expect(headline([1, 2, 3], "last")).toBe(3);
  });

  it("returns null for an absent or empty series", () => {
    expect(headline(undefined, "sum")).toBeNull();
    expect(headline([], "avg")).toBeNull();
  });

  it("averages over REPORTING days, so a 30-day window with 29 days is not diluted", () => {
    expect(headline([10, 20], "avg")).toBe(15);
  });

  it("rounds averages to 1dp and everything else to whole numbers", () => {
    expect(roundHeadline(80.75, "avg")).toBe(80.8);
    expect(roundHeadline(80.75, "sum")).toBe(81);
    expect(roundHeadline(null, "sum")).toBeNull();
  });
});
