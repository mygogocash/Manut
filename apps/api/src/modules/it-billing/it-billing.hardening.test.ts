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
    subscriptionsForMonthlySeries: vi.fn(),
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
    cancelledAt: null,
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

describe("cancellation effective date", () => {
  // `cancelledAt` is what the monthly spend series reads to place the
  // step-down, so getting it from the wrong date silently moves a whole month
  // of spend.
  const RENEWAL = new Date("2026-12-31T00:00:00.000Z");

  it("defaults to the renewal date, not today — that is the paid-through date", async () => {
    findSubscription.mockResolvedValue(sub({ renewalDate: RENEWAL }));
    await service.recordRenewalDecision("sub-1", { decision: "cancel" }, ACTOR);
    expect(updateSubscription).toHaveBeenCalledWith(
      "sub-1",
      expect.objectContaining({ cancelledAt: RENEWAL }),
    );
  });

  it("uses an explicit effectiveDate over the renewal date", async () => {
    findSubscription.mockResolvedValue(sub({ renewalDate: RENEWAL }));
    await service.recordRenewalDecision(
      "sub-1",
      { decision: "cancel", effectiveDate: "2026-08-31" },
      ACTOR,
    );
    expect(updateSubscription).toHaveBeenCalledWith(
      "sub-1",
      expect.objectContaining({
        cancelledAt: new Date("2026-08-31T00:00:00.000Z"),
      }),
    );
  });

  it("falls back to today when there is no renewal date, never to null", async () => {
    // A null stop date on a cancelled row would read as "still running" in the
    // series, so the spend would never fall.
    findSubscription.mockResolvedValue(sub({ renewalDate: null }));
    await service.recordRenewalDecision("sub-1", { decision: "cancel" }, ACTOR);
    const payload = updateSubscription.mock.calls[0]?.[1] as {
      cancelledAt: Date | null;
    };
    expect(payload.cancelledAt).toBeInstanceOf(Date);
  });

  it("clears the date on renew, so a revived subscription costs money again", async () => {
    findSubscription.mockResolvedValue(
      sub({ status: "cancelled", cancelledAt: RENEWAL }),
    );
    await service.recordRenewalDecision("sub-1", { decision: "renew" }, ACTOR);
    expect(updateSubscription).toHaveBeenCalledWith(
      "sub-1",
      expect.objectContaining({ cancelledAt: null }),
    );
  });

  it("clears the date when an edit moves status off cancelled", async () => {
    findSubscription.mockResolvedValue(
      sub({ status: "cancelled", cancelledAt: RENEWAL }),
    );
    await service.updateSubscription("sub-1", { status: "active" }, ACTOR);
    expect(updateSubscription).toHaveBeenCalledWith(
      "sub-1",
      expect.objectContaining({ status: "active", cancelledAt: null }),
    );
  });

  it("lets an explicit cancelledAt in the same edit win over that clearing", async () => {
    findSubscription.mockResolvedValue(
      sub({ status: "cancelled", cancelledAt: RENEWAL }),
    );
    await service.updateSubscription(
      "sub-1",
      { status: "active", cancelledAt: "2027-01-31" },
      ACTOR,
    );
    expect(updateSubscription).toHaveBeenCalledWith(
      "sub-1",
      expect.objectContaining({
        cancelledAt: new Date("2027-01-31T00:00:00.000Z"),
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

describe("cancellation date via the edit form (not the decision flow)", () => {
  const RENEWAL_END = new Date("2026-12-31T00:00:00.000Z");

  it("keeps a SCHEDULED future cancellation through an unrelated edit", async () => {
    // Found by adversarial review. The edit form always sends `status`, so on an
    // active row carrying a future cancelledAt, `status: "active"` looked like a
    // revival and silently wiped the scheduled date.
    findSubscription.mockResolvedValue(
      sub({ status: "active", cancelledAt: RENEWAL_END }),
    );
    await service.updateSubscription(
      "sub-1",
      { status: "active", notes: "moved to floor 3" },
      ACTOR,
    );
    const payload = updateSubscription.mock.calls[0]?.[1] as Record<
      string,
      unknown
    >;
    expect("cancelledAt" in payload).toBe(false);
  });

  it("still clears the date when a genuinely cancelled row is revived", async () => {
    findSubscription.mockResolvedValue(
      sub({ status: "cancelled", cancelledAt: RENEWAL_END }),
    );
    await service.updateSubscription("sub-1", { status: "active" }, ACTOR);
    expect(updateSubscription).toHaveBeenCalledWith(
      "sub-1",
      expect.objectContaining({ cancelledAt: null }),
    );
  });

  it("stamps a date when the edit form cancels, instead of leaving it inferred", async () => {
    // endMonth's last-resort fallback is `updatedAt`, which is MUTABLE — without
    // a stamp the step-down month moved every time anyone touched the row.
    findSubscription.mockResolvedValue(
      sub({ status: "active", cancelledAt: null, renewalDate: RENEWAL_END }),
    );
    await service.updateSubscription("sub-1", { status: "cancelled" }, ACTOR);
    expect(updateSubscription).toHaveBeenCalledWith(
      "sub-1",
      expect.objectContaining({
        status: "cancelled",
        cancelledAt: RENEWAL_END,
      }),
    );
  });

  it("does not overwrite a cancelledAt the row already has", async () => {
    const already = new Date("2026-05-31T00:00:00.000Z");
    findSubscription.mockResolvedValue(
      sub({ status: "cancelled", cancelledAt: already }),
    );
    await service.updateSubscription("sub-1", { status: "cancelled" }, ACTOR);
    const payload = updateSubscription.mock.calls[0]?.[1] as Record<
      string,
      unknown
    >;
    expect("cancelledAt" in payload).toBe(false);
  });
});
