import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { NotFoundException } from "@/common/exceptions/http-exception";
import { itBillingRepository } from "@/modules/it-billing/it-billing.repository";
import {
  ItBillingService,
  toMonthlySpend,
} from "@/modules/it-billing/it-billing.service";

vi.mock("@/infrastructure/audit/audit.service", () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./it-billing.repository", () => ({
  itBillingRepository: {
    listVendors: vi.fn(),
    findVendor: vi.fn(),
    createVendor: vi.fn(),
    updateVendor: vi.fn(),
    deleteVendor: vi.fn(),
    listSubscriptions: vi.fn(),
    countSubscriptions: vi.fn(),
    findSubscription: vi.fn(),
    createSubscription: vi.fn(),
    updateSubscription: vi.fn(),
    deleteSubscription: vi.fn(),
    activeSubscriptions: vi.fn(),
    subscriptionsForMonthlySeries: vi.fn(),
    countActiveSubscriptions: vi.fn(),
    upcomingRenewals: vi.fn(),
  },
}));

const activeSubscriptions = itBillingRepository.activeSubscriptions as Mock;
const findSubscription = itBillingRepository.findSubscription as Mock;
const createVendor = itBillingRepository.createVendor as Mock;

const service = new ItBillingService();
const ACTOR = "11111111-1111-1111-1111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("toMonthlySpend", () => {
  it("normalizes annual to monthly", () => {
    expect(toMonthlySpend(1200, "annual")).toBe(100);
  });
  it("normalizes quarterly to monthly", () => {
    expect(toMonthlySpend(300, "quarterly")).toBe(100);
  });
  it("keeps monthly as-is", () => {
    expect(toMonthlySpend(100, "monthly")).toBe(100);
  });
  it("excludes one-time from recurring spend", () => {
    expect(toMonthlySpend(5000, "one-time")).toBe(0);
  });
});

describe("monthlySpendReport", () => {
  it("rolls up monthly-equivalent spend by currency across the whole set", async () => {
    activeSubscriptions.mockResolvedValue([
      {
        invoiceAmount: 1200,
        billingFrequency: "annual",
        currency: "USD",
        vendor: { id: "v1", name: "A" },
      },
      {
        invoiceAmount: 50,
        billingFrequency: "monthly",
        currency: "USD",
        vendor: { id: "v2", name: "B" },
      },
      {
        invoiceAmount: 300,
        billingFrequency: "quarterly",
        currency: "EUR",
        vendor: { id: "v3", name: "C" },
      },
    ]);
    const { data } = await service.monthlySpendReport();
    expect(data.totalMonthlyByCurrency).toEqual({ USD: 150, EUR: 100 });
    expect(data.annualizedByCurrency).toEqual({ USD: 1800, EUR: 1200 });
    expect(data.subscriptionCount).toBe(3);
  });
});

describe("vendorCostReport", () => {
  it("aggregates spend per vendor, sorted descending", async () => {
    activeSubscriptions.mockResolvedValue([
      {
        invoiceAmount: 100,
        billingFrequency: "monthly",
        currency: "USD",
        vendor: { id: "v1", name: "Cheap" },
      },
      {
        invoiceAmount: 1200,
        billingFrequency: "annual",
        currency: "USD",
        vendor: { id: "v2", name: "Big" },
      },
      {
        invoiceAmount: 1200,
        billingFrequency: "monthly",
        currency: "USD",
        vendor: { id: "v2", name: "Big" },
      },
    ]);
    const { data } = await service.vendorCostReport();
    expect(data[0]).toMatchObject({
      vendorName: "Big",
      monthlySpend: 1300,
      subscriptionCount: 2,
    });
    expect(data[1]).toMatchObject({ vendorName: "Cheap", monthlySpend: 100 });
  });
});

describe("createVendor", () => {
  it("defaults isActive and stamps the creator", async () => {
    createVendor.mockResolvedValue({
      id: "ven-1",
      name: "GitHub",
      contactPerson: null,
      email: null,
      phone: null,
      notes: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      _count: { subscriptions: 0 },
    });
    const { data } = await service.createVendor({ name: "GitHub" }, ACTOR);
    expect(createVendor).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "GitHub",
        isActive: true,
        createdById: ACTOR,
      }),
    );
    expect(data.name).toBe("GitHub");
  });
});

describe("getSubscription", () => {
  it("throws NotFound when the subscription is missing", async () => {
    findSubscription.mockResolvedValue(null);
    await expect(service.getSubscription("missing")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
