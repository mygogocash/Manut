import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { chunk, ingestAnalyticsApi } from "../ow-analytics-api.service";

const CATALOG = {
  core_metrics: [],
  transaction_type_pattern: "tx.<transaction_type>.<field>",
  transaction_type_fields: ["count", "amount", "unique_users"],
  known_transaction_types: ["purchase", "use_pass"],
};
const QUERY = {
  date_from: "2026-05-12",
  date_to: "2026-05-12",
  results: [
    {
      partner_id: "u1",
      telco_name: "GoPay",
      series: [{ date: "2026-05-12", metrics: { dau: 100 } }],
    },
  ],
};

function mockFetch() {
  return vi.fn(async (url: string) => {
    if (String(url).includes("/catalog")) {
      return { ok: true, json: async () => CATALOG } as unknown as Response;
    }
    return { ok: true, json: async () => QUERY } as unknown as Response;
  });
}

describe("chunk", () => {
  it("splits into <=size groups preserving order", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
});

describe("ingestAnalyticsApi", () => {
  const OLD = { ...process.env };
  beforeEach(() => {
    process.env.MARKETING_ANALYTICS_API_URL = "https://x";
    process.env.MARKETING_ANALYTICS_PARTNER_IDS = "gopay:u1";
    process.env.MARKETING_ANALYTICS_BACKFILL_FROM = "2026-05-12";
  });
  afterEach(() => {
    process.env = { ...OLD };
    vi.restoreAllMocks();
  });

  it("returns normalized rows + synthesized rawTabs", async () => {
    vi.stubGlobal("fetch", mockFetch());
    const res = await ingestAnalyticsApi();
    expect(res.metrics).toHaveLength(1);
    expect(res.metrics[0]!.telco).toBe("gopay");
    expect(res.metrics[0]!.values.dauCrm).toBe(100);
    expect(res.rawTabs).toHaveLength(1);
  });

  it("never throws — a failed fetch yields an empty result + warning", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("boom");
      }),
    );
    const res = await ingestAnalyticsApi();
    expect(res.metrics).toHaveLength(0);
    expect(
      res.warnings.some(
        (w) =>
          w.toLowerCase().includes("boom") ||
          w.toLowerCase().includes("failed"),
      ),
    ).toBe(true);
  });

  it("falls back to FALLBACK_TX_TYPES when the catalog call fails", async () => {
    const f = vi.fn(async (url: string) => {
      if (String(url).includes("/catalog")) {
        return { ok: false, status: 500 } as unknown as Response;
      }
      return { ok: true, json: async () => QUERY } as unknown as Response;
    });
    vi.stubGlobal("fetch", f);
    const res = await ingestAnalyticsApi();
    expect(res.metrics).toHaveLength(1); // query still ran
  });
});
