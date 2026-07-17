import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { itBillingRepository } from "@/modules/it-billing/it-billing.repository";
import {
  ItBillingService,
  seatMetrics,
} from "@/modules/it-billing/it-billing.service";

vi.mock("@/infrastructure/audit/audit.service", () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./it-billing.repository", () => ({
  itBillingRepository: {
    findSubscription: vi.fn(),
    updateSubscription: vi.fn(),
    activeSubscriptions: vi.fn(),
  },
}));

const findSubscription = itBillingRepository.findSubscription as Mock;
const updateSubscription = itBillingRepository.updateSubscription as Mock;
const activeSubscriptions = itBillingRepository.activeSubscriptions as Mock;

const service = new ItBillingService();
const ACTOR = "11111111-1111-1111-1111-111111111111";

function sub(over: Record<string, unknown> = {}) {
  return {
    id: "sub-1",
    vendorId: "v1",
    vendor: { id: "v1", name: "GitHub" },
    category: "engineering",
    productName: "GitHub",
    contractStartDate: null,
    renewalDate: null,
    billingFrequency: "monthly",
    invoiceAmount: 100,
    currency: "USD",
    paymentStatus: "paid",
    status: "active",
    owner: null,
    ownerUserId: null,
    notes: null,
    totalSeats: 10,
    assignedSeats: 6,
    activeSeats: 4,
    renewalDecision: null,
    renewalDecisionAt: null,
    renewalDecisionById: null,
    renewalDecisionNotes: null,
    attachments: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  updateSubscription.mockImplementation(async (id, data) =>
    sub({ id, ...data }),
  );
});

describe("seatMetrics", () => {
  it("derives unused seats and utilization from source counts", () => {
    const m = seatMetrics({
      totalSeats: 10,
      assignedSeats: 6,
      activeSeats: 4,
      invoiceAmount: 100,
      billingFrequency: "monthly",
    });
    expect(m.unusedSeats).toBe(4); // 10 - 6
    expect(m.utilizationPercentage).toBe(40); // 4 / 10
    // per-seat monthly = 100/10 = 10; unused 4 -> 40 potential savings
    expect(m.potentialMonthlySavings).toBe(40);
  });

  it("returns null utilization and zero savings when not seat-based", () => {
    const m = seatMetrics({
      totalSeats: null,
      assignedSeats: 0,
      activeSeats: 0,
      invoiceAmount: 500,
      billingFrequency: "annual",
    });
    expect(m.unusedSeats).toBe(0);
    expect(m.utilizationPercentage).toBeNull();
    expect(m.potentialMonthlySavings).toBe(0);
  });

  it("never reports negative unused seats when assigned exceeds total", () => {
    const m = seatMetrics({
      totalSeats: 5,
      assignedSeats: 8,
      activeSeats: 5,
      invoiceAmount: 50,
      billingFrequency: "monthly",
    });
    expect(m.unusedSeats).toBe(0);
  });
});

describe("licenseSummary", () => {
  it("aggregates licenses and potential savings across the whole active set", async () => {
    activeSubscriptions.mockResolvedValue([
      sub({
        totalSeats: 10,
        assignedSeats: 6,
        activeSeats: 4,
        invoiceAmount: 100,
        billingFrequency: "monthly",
      }),
      sub({
        id: "s2",
        totalSeats: 20,
        assignedSeats: 20,
        activeSeats: 20,
        invoiceAmount: 200,
        billingFrequency: "monthly",
      }),
      sub({
        id: "s3",
        totalSeats: null,
        invoiceAmount: 999,
        billingFrequency: "annual",
      }),
    ]);
    const { data } = await service.licenseSummary();
    expect(data.totalLicenses).toBe(30); // 10 + 20 (non-seat excluded)
    expect(data.assignedLicenses).toBe(26);
    expect(data.unusedLicenses).toBe(4);
    expect(data.potentialMonthlySavingsByCurrency).toEqual({ USD: 40 });
  });
});

describe("recordRenewalDecision", () => {
  it("renew -> status renewed, stamps decision, re-arms reminders", async () => {
    findSubscription.mockResolvedValue(sub());
    const { data } = await service.recordRenewalDecision(
      "sub-1",
      { decision: "renew", notes: "good value" },
      ACTOR,
    );
    expect(updateSubscription).toHaveBeenCalledWith(
      "sub-1",
      expect.objectContaining({
        status: "renewed",
        renewalDecision: "renew",
        renewalDecisionById: ACTOR,
        remindersSent: [],
      }),
    );
    expect(data.status).toBe("renewed");
  });

  it("cancel -> status cancelled", async () => {
    findSubscription.mockResolvedValue(sub());
    await service.recordRenewalDecision("sub-1", { decision: "cancel" }, ACTOR);
    expect(updateSubscription).toHaveBeenCalledWith(
      "sub-1",
      expect.objectContaining({
        status: "cancelled",
        renewalDecision: "cancel",
      }),
    );
  });
});

describe("attachment management", () => {
  it("appends an attachment to the JSON column", async () => {
    findSubscription.mockResolvedValue(sub({ attachments: [] }));
    await service.addSubscriptionAttachment(
      "sub-1",
      { name: "contract.pdf", url: "https://x/contract.pdf", kind: "contract" },
      ACTOR,
    );
    expect(updateSubscription).toHaveBeenCalledWith(
      "sub-1",
      expect.objectContaining({
        attachments: [
          expect.objectContaining({ url: "https://x/contract.pdf" }),
        ],
      }),
    );
  });

  it("removes an attachment by url", async () => {
    findSubscription.mockResolvedValue(
      sub({
        attachments: [
          { name: "a", url: "https://x/a.pdf", kind: "invoice" },
          { name: "b", url: "https://x/b.pdf", kind: "contract" },
        ],
      }),
    );
    await service.removeSubscriptionAttachment(
      "sub-1",
      { url: "https://x/a.pdf" },
      ACTOR,
    );
    expect(updateSubscription).toHaveBeenCalledWith(
      "sub-1",
      expect.objectContaining({
        attachments: [expect.objectContaining({ url: "https://x/b.pdf" })],
      }),
    );
  });
});
