import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { prisma } from "@/infrastructure/database/prisma";
import { MarketingReportsService } from "@/modules/marketing-reports/marketing-reports.service";

vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    mktCampaign: {
      findMany: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
      aggregate: vi.fn(),
    },
  },
}));

const findMany = prisma.mktCampaign.findMany as unknown as Mock;
const count = prisma.mktCampaign.count as unknown as Mock;

const service = new MarketingReportsService();

beforeEach(() => {
  vi.clearAllMocks();
});

describe("predictionVsActual", () => {
  it("computes difference and performance %", async () => {
    findMany.mockResolvedValue([
      {
        id: "c1",
        name: "A",
        campaignDate: new Date("2026-07-01T00:00:00Z"),
        status: "completed",
        channel: "Push",
        expectedReach: 1000,
        actualReach: 1200,
      },
      {
        id: "c2",
        name: "B",
        campaignDate: new Date("2026-07-02T00:00:00Z"),
        status: "live",
        channel: "Email",
        expectedReach: 500,
        actualReach: null,
      },
    ]);
    count.mockResolvedValue(2);
    const res = await service.predictionVsActual({
      filter: {},
      page: 1,
      limit: 20,
      sortBy: "campaignDate",
      sortDir: "desc",
    });
    expect(res.data[0]).toMatchObject({
      predicted: 1000,
      actual: 1200,
      difference: 200,
      performancePct: 120,
    });
    // No actual -> difference and performance are null.
    expect(res.data[1]).toMatchObject({
      difference: null,
      performancePct: null,
    });
    expect(res.meta.total).toBe(2);
  });

  it("falls back to campaignDate for an unknown sort field", async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);
    await service.predictionVsActual({
      filter: {},
      page: 1,
      limit: 20,
      sortBy: "hacky",
      sortDir: "asc",
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { campaignDate: "asc" } }),
    );
  });
});

describe("campaignSummary", () => {
  it("buckets by month and sums reach/budget", async () => {
    findMany.mockResolvedValue([
      {
        campaignDate: new Date("2026-07-01T00:00:00Z"),
        expectedReach: 100,
        actualReach: 90,
        budget: 500,
      },
      {
        campaignDate: new Date("2026-07-20T00:00:00Z"),
        expectedReach: 200,
        actualReach: 260,
        budget: 300,
      },
      {
        campaignDate: new Date("2026-08-02T00:00:00Z"),
        expectedReach: 50,
        actualReach: 25,
        budget: 0,
      },
    ]);
    const res = await service.campaignSummary("monthly", {});
    expect(res.data).toHaveLength(2);
    expect(res.data[0]).toMatchObject({
      period: "2026-07",
      campaigns: 2,
      expectedReach: 300,
      actualReach: 350,
      budget: 800,
    });
    expect(res.data[1]).toMatchObject({ period: "2026-08", actualReach: 25 });
  });
});

describe("leverPerformance", () => {
  it("aggregates per lever with average performance", async () => {
    findMany.mockResolvedValue([
      {
        expectedReach: 100,
        actualReach: 200, // perf 200
        budget: 100,
        levers: [{ lever: { id: "l1", name: "Push" } }],
      },
      {
        expectedReach: 100,
        actualReach: 100, // perf 100
        budget: 50,
        levers: [{ lever: { id: "l1", name: "Push" } }],
      },
    ]);
    const res = await service.leverPerformance({});
    expect(res.data[0]).toMatchObject({
      lever: "Push",
      campaigns: 2,
      actualReach: 300,
      avgPerformancePct: 150, // (200 + 100) / 2
    });
  });
});
