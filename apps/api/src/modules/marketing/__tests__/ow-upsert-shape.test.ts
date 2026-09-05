import { describe, expect, it } from "vitest";

import { buildMetricUpdateData } from "../marketing.repository";

describe("buildMetricUpdateData", () => {
  it("coerces amount keys to bigint, counts to int, and carries txMetrics", () => {
    const data = buildMetricUpdateData({
      date: new Date("2026-05-12T00:00:00.000Z"),
      telco: "gopay",
      values: {
        dauCrm: 100,
        bnryEarned: 5000000000,
        avgSessionSec: 43.6,
        uniqueUsers: null as unknown as number,
      },
      txMetrics: { "tx.purchase.amount": 900 },
      isIntraday: false,
      sourceTab: "analytics-api",
    });
    expect(data.dauCrm).toBe(100);
    expect(typeof data.bnryEarned).toBe("bigint");
    expect(data.bnryEarned).toBe(5000000000n);
    expect(data.avgSessionSec).toBe(44);
    expect("uniqueUsers" in data).toBe(false);
    expect(data.sourceTab).toBe("analytics-api");
    expect(data.isIntraday).toBe(false);
    expect(data.txMetrics).toEqual({ "tx.purchase.amount": 900 });
  });
  it("omits txMetrics when absent", () => {
    const data = buildMetricUpdateData({
      date: new Date("2026-05-12T00:00:00.000Z"),
      telco: "gopay",
      values: { dauCrm: 1 },
      isIntraday: false,
      sourceTab: "analytics-api",
    });
    expect("txMetrics" in data).toBe(false);
  });
});
