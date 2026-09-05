import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { itBillingRepository } from "@/modules/it-billing/it-billing.repository";
import { ItOperationsService } from "@/modules/it-operations/it-operations.service";

vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    itAccessRequest: { findMany: vi.fn().mockResolvedValue([]) },
    itAccessAssignment: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

vi.mock("@/infrastructure/audit/audit.service", () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}));

// The dashboard reaches the monthly series through the real it-billing service,
// so only the repository is mocked — the arithmetic under test is the genuine
// engine, not a stub of it.
vi.mock("@/modules/it-billing/it-billing.repository", () => ({
  itBillingRepository: {
    activeSubscriptions: vi.fn(),
    countActiveSubscriptions: vi.fn(),
    upcomingRenewals: vi.fn(),
    subscriptionsForMonthlySeries: vi.fn(),
  },
}));

const activeSubscriptions = itBillingRepository.activeSubscriptions as Mock;
const countActiveSubscriptions =
  itBillingRepository.countActiveSubscriptions as Mock;
const upcomingRenewals = itBillingRepository.upcomingRenewals as Mock;
const forSeries = itBillingRepository.subscriptionsForMonthlySeries as Mock;

const service = new ItOperationsService();

/** A subscription row shaped as `subscriptionsForMonthlySeries` returns it. */
function sub(over: Record<string, unknown> = {}) {
  return {
    id: "sub-1",
    vendorId: "v1",
    vendor: { id: "v1", name: "Upstash" },
    category: "saas",
    productName: "Upstash",
    contractStartDate: new Date("2020-01-01T00:00:00.000Z"),
    renewalDate: null,
    cancelledAt: null,
    billingFrequency: "monthly",
    invoiceAmount: 100,
    currency: "USD",
    paymentStatus: "paid",
    status: "active",
    totalSeats: null,
    assignedSeats: 0,
    activeSeats: 0,
    renewalDecision: null,
    renewalDecisionAt: null,
    createdAt: new Date("2020-01-01T00:00:00.000Z"),
    updatedAt: new Date("2020-01-01T00:00:00.000Z"),
    ...over,
  };
}

function monthKeyOf(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

beforeEach(() => {
  vi.clearAllMocks();
  countActiveSubscriptions.mockResolvedValue(0);
  upcomingRenewals.mockResolvedValue([]);
  activeSubscriptions.mockResolvedValue([]);
  forSeries.mockResolvedValue([]);
});

describe("IT Operations dashboard spend trend", () => {
  it("is HISTORICAL — the last point is the current month, not a future one", async () => {
    // The bug this replaces: the trend projected the NEXT six months, so its
    // first point was the current month and the rest had not happened yet.
    forSeries.mockResolvedValue([sub()]);
    const { data } = await service.dashboard();
    const points = data.charts.spendTrend;
    const last = points[points.length - 1];
    expect(last?.month).toBe(monthKeyOf(new Date()));
  });

  it("runs 12 trailing months, oldest first", async () => {
    forSeries.mockResolvedValue([sub()]);
    const { data } = await service.dashboard();
    const points = data.charts.spendTrend;
    expect(points).toHaveLength(12);
    const months = points.map((p) => p.month);
    expect([...months].sort()).toEqual(months);
    expect(months[0]! < months[months.length - 1]!).toBe(true);
  });

  it("is not flat — a mid-window cancellation makes the line FALL", async () => {
    // The whole point. The old chart repeated one run-rate figure, so no
    // cancellation could ever move it, and the cancelled row was excluded from
    // the figure anyway.
    const now = new Date();
    const stoppedAt = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 28),
    );
    forSeries.mockResolvedValue([
      sub({ id: "kept", productName: "Sentry", invoiceAmount: 100 }),
      sub({
        id: "gone",
        productName: "Upstash",
        invoiceAmount: 300,
        status: "cancelled",
        cancelledAt: stoppedAt,
      }),
    ]);

    const { data } = await service.dashboard();
    const points = data.charts.spendTrend;
    const stoppedKey = monthKeyOf(stoppedAt);
    const atStop = points.find((p) => p.month === stoppedKey);
    const afterStop = points.find((p) => p.month > stoppedKey);

    expect(atStop?.amount).toBe(400);
    expect(afterStop?.amount).toBe(100);
    expect(afterStop!.amount).toBeLessThan(atStop!.amount);
  });

  it("counts a cancelled subscription in the months it was still live", async () => {
    // `activeSubscriptions()` excludes cancelled rows and is deliberately NOT
    // what feeds the trend; if it were, this month would read 0.
    const now = new Date();
    const stoppedAt = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 3, 15),
    );
    forSeries.mockResolvedValue([
      sub({ status: "cancelled", cancelledAt: stoppedAt, invoiceAmount: 250 }),
    ]);
    const { data } = await service.dashboard();
    const atStop = data.charts.spendTrend.find(
      (p) => p.month === monthKeyOf(stoppedAt),
    );
    expect(atStop?.amount).toBe(250);
  });

  it("names the single currency it charts", async () => {
    forSeries.mockResolvedValue([
      sub({ id: "a", currency: "USD", invoiceAmount: 100 }),
      sub({ id: "b", currency: "THB", invoiceAmount: 9000 }),
    ]);
    const { data } = await service.dashboard();
    // THB carries the larger run-rate, so it is the reported series — and the
    // amounts must be THB only, never THB + USD.
    expect(data.charts.spendTrendCurrency).toBe("THB");
    const last = data.charts.spendTrend.at(-1);
    expect(last?.amount).toBe(9000);
  });

  it("still derives the KPI run-rate from active subscriptions only", async () => {
    // The cards answer "what do we pay now", so cancelled rows must NOT appear
    // there even though they do appear in the trend.
    // The vendor breakdown reads `s.vendor.id`, so the active-subscription
    // shape needs its relation even though this test is about the cards.
    activeSubscriptions.mockResolvedValue([sub({ invoiceAmount: 100 })]);
    forSeries.mockResolvedValue([
      sub({ invoiceAmount: 100 }),
      sub({ id: "gone", status: "cancelled", invoiceAmount: 999 }),
    ]);
    const { data } = await service.dashboard();
    expect(data.cards.monthlySpendByCurrency).toEqual({ USD: 100 });
  });

  it("returns an empty trend rather than throwing with no subscriptions", async () => {
    const { data } = await service.dashboard();
    expect(data.charts.spendTrend).toHaveLength(12);
    expect(data.charts.spendTrend.every((p) => p.amount === 0)).toBe(true);
    expect(data.charts.spendTrendCurrency).toBe("USD");
  });
});
