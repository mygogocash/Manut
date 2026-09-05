import { beforeEach, describe, expect, it, vi } from "vitest";

import { BadRequestException } from "@/common/exceptions/http-exception";
import { prisma } from "@/infrastructure/database/prisma";
import { marketingAnalyticsService } from "@/modules/marketing-analytics/marketing-analytics.service";
import { dauMauQuerySchema } from "@/modules/marketing-analytics/marketing-analytics.validation";

vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    systemSetting: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

const settingMock = prisma.systemSetting as unknown as {
  findUnique: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
};

const CATALOG = {
  core_metrics: ["dau", "total_transactions", "avg_time_spent_seconds"],
  transaction_type_pattern: "transactions.{type}",
  transaction_type_fields: ["amount", "count"],
  known_transaction_types: ["FOLLOW_GIVEN", "QUEST_REWARD"],
};
const DICTIONARY = {
  metrics: {
    dau: "Daily active users.",
    total_transactions: "Total transactions that day.",
    avg_time_spent_seconds: "Average session duration.",
  },
  transaction_type_field_descriptions: { amount: "Value moved." },
  known_transaction_type_descriptions: { FOLLOW_GIVEN: "A follow was given." },
  note: "Telco-day aligned.",
};

function mockFetch() {
  return vi.fn(async (url: string) => {
    const body = url.includes("/dictionary") ? DICTIONARY : CATALOG;
    return {
      ok: true,
      status: 200,
      json: async () => body,
    } as Response;
  });
}

beforeEach(async () => {
  vi.stubGlobal("fetch", mockFetch());
  // Reset the module-level cache to a known snapshot before each test.
  await marketingAnalyticsService.refresh();
});

describe("dashboard", () => {
  it("returns dynamic counts by group derived from the catalog", async () => {
    const { data } = await marketingAnalyticsService.dashboard();
    expect(data.totalMetrics).toBe(7); // 3 core + 2 types + 2 fields
    expect(data.byGroup).toEqual([
      { group: "core", count: 3 },
      { group: "transaction-type", count: 2 },
      { group: "field", count: 2 },
    ]);
    expect(data.transactionTypePattern).toBe("transactions.{type}");
    expect(data.note).toBe("Telco-day aligned.");
    expect(data.lastSyncedAt).toBeTruthy();
  });
});

describe("listMetrics", () => {
  it("normalizes metrics with dictionary descriptions and prettified labels", async () => {
    const { data } = await marketingAnalyticsService.listMetrics({
      page: 1,
      limit: 100,
    });
    const dau = data.find((m) => m.key === "dau");
    expect(dau).toMatchObject({
      key: "dau",
      label: "Dau",
      description: "Daily active users.",
      group: "core",
    });
    const total = data.find((m) => m.key === "total_transactions");
    expect(total?.label).toBe("Total Transactions");
  });

  it("filters by group", async () => {
    const { data, meta } = await marketingAnalyticsService.listMetrics({
      page: 1,
      limit: 100,
      group: "transaction-type",
    });
    expect(meta.total).toBe(2);
    expect(data.every((m) => m.group === "transaction-type")).toBe(true);
  });

  it("searches across key, label, and description", async () => {
    const { data } = await marketingAnalyticsService.listMetrics({
      page: 1,
      limit: 100,
      search: "session",
    });
    expect(data).toHaveLength(1);
    expect(data[0]?.key).toBe("avg_time_spent_seconds");
  });

  it("paginates server-side", async () => {
    const { data, meta } = await marketingAnalyticsService.listMetrics({
      page: 1,
      limit: 3,
    });
    expect(data).toHaveLength(3);
    expect(meta.total).toBe(7);
  });

  it("rejects an invalid group", async () => {
    await expect(
      marketingAnalyticsService.listMetrics({
        page: 1,
        limit: 10,
        group: "bogus",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe("refresh", () => {
  it("re-fetches the upstream catalog + dictionary", async () => {
    const spy = mockFetch();
    vi.stubGlobal("fetch", spy);
    await marketingAnalyticsService.refresh();
    // one call for catalog + one for dictionary
    expect(spy).toHaveBeenCalledTimes(2);
  });
});

describe("overview content", () => {
  beforeEach(() => {
    settingMock.findUnique.mockReset();
    settingMock.upsert.mockReset();
  });

  it("returns seeded defaults when no row exists", async () => {
    settingMock.findUnique.mockResolvedValue(null);
    const c = await marketingAnalyticsService.getOverviewContent();
    expect(c.learningsShared.length).toBeGreaterThan(0);
    expect(c.macroHeadline).toBeTruthy();
    expect(Array.isArray(c.macroPlays)).toBe(true);
  });

  it("normalizes a stored row and drops malformed entries", async () => {
    settingMock.findUnique.mockResolvedValue({
      key: "marketing.overview_content",
      value: {
        learningsShared: [
          { tag: "SMS", text: "Heaviest lever." },
          { tag: "bad" }, // missing text -> dropped
        ],
        learningsPerTelco: { Dialog: ["a", 2, "b"] }, // 2 -> dropped
        macroHeadline: "H",
        macroBody: "B",
        macroPlays: [{ step: "1", title: "T", text: "X" }],
      },
    });
    const c = await marketingAnalyticsService.getOverviewContent();
    expect(c.learningsShared).toEqual([
      { tag: "SMS", text: "Heaviest lever." },
    ]);
    expect(c.learningsPerTelco.Dialog).toEqual(["a", "b"]);
    expect(c.macroHeadline).toBe("H");
  });

  it("coerces + upserts on save", async () => {
    settingMock.upsert.mockResolvedValue({});
    const saved = await marketingAnalyticsService.setOverviewContent({
      learningsShared: [{ tag: "SMS", text: "x" }],
      learningsPerTelco: { U9: ["one"] },
      macroHeadline: "head",
      macroBody: "body",
      macroPlays: [{ step: "1", title: "t", text: "x" }],
    });
    expect(settingMock.upsert).toHaveBeenCalledOnce();
    expect(saved.macroHeadline).toBe("head");
    expect(saved.learningsPerTelco.U9).toEqual(["one"]);
  });
});

// ── DAU/MAU query: which accounts count ─────────────────────────
//
// The page sends this on every fetch, so its edge cases decide whether a stale
// link renders, 400s, or silently reports a different set of accounts than the
// one the reader has checked.
describe("dauMauQuerySchema accounts", () => {
  const parse = (accounts?: string) =>
    dauMauQuerySchema.parse(accounts === undefined ? {} : { accounts });

  it("omits the field entirely when nothing is narrowed", () => {
    expect(parse().accounts).toBeUndefined();
  });

  it("splits a comma-separated list into keys", () => {
    expect(parse("gopay,dialog").accounts).toEqual(["gopay", "dialog"]);
  });

  it("tolerates whitespace and trailing separators from hand-edited URLs", () => {
    expect(parse(" gopay , dialog ,").accounts).toEqual(["gopay", "dialog"]);
  });

  // An empty list must not be read as "all": that would report totals for
  // accounts the caller had just deselected.
  it("rejects an explicitly empty selection", () => {
    expect(() => parse("")).toThrow();
    expect(() => parse(" , ")).toThrow();
  });

  it("accepts a single account", () => {
    expect(parse("okara").accounts).toEqual(["okara"]);
  });
});
