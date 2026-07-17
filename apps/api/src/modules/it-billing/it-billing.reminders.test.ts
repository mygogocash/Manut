import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { prisma } from "@/infrastructure/database/prisma";
import { processBillingReminders } from "@/modules/it-billing/it-billing.reminders";
import { itBillingRepository } from "@/modules/it-billing/it-billing.repository";

vi.mock("@/infrastructure/email/email.service", () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: { itSubscription: { update: vi.fn() } },
}));

vi.mock("./it-billing.repository", () => ({
  itBillingRepository: {
    subscriptionsForReminderScan: vi.fn(),
    createAlert: vi.fn(),
  },
}));

const scan = itBillingRepository.subscriptionsForReminderScan as Mock;
const createAlert = itBillingRepository.createAlert as Mock;
const update = prisma.itSubscription.update as unknown as Mock;

const DAY = 24 * 60 * 60 * 1000;
function inDays(n: number): Date {
  return new Date(Date.now() + n * DAY);
}

function sub(over: Record<string, unknown> = {}) {
  return {
    id: "sub-1",
    productName: "GitHub",
    currency: "USD",
    invoiceAmount: 1200,
    billingFrequency: "annual",
    renewalDate: inDays(30),
    paymentStatus: "paid",
    remindersSent: [],
    renewalDecision: null,
    owner: null,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  update.mockResolvedValue({});
});

describe("processBillingReminders - renewal ladder", () => {
  it("fires renewal-30 when renewal is ~30 days out", async () => {
    scan.mockResolvedValue([sub({ renewalDate: inDays(29) })]);
    const r = await processBillingReminders();
    expect(createAlert).toHaveBeenCalledWith(
      expect.objectContaining({ alertType: "renewal-30" }),
    );
    expect(r.alertsCreated).toBe(1);
  });

  it("fires renewal-15 at ~15 days (nearest unfired rung)", async () => {
    scan.mockResolvedValue([
      sub({ renewalDate: inDays(14), remindersSent: ["renewal-30"] }),
    ]);
    await processBillingReminders();
    expect(createAlert).toHaveBeenCalledWith(
      expect.objectContaining({ alertType: "renewal-15" }),
    );
  });

  it("fires renewal-7 at ~7 days", async () => {
    scan.mockResolvedValue([
      sub({
        renewalDate: inDays(6),
        remindersSent: ["renewal-30", "renewal-15"],
      }),
    ]);
    await processBillingReminders();
    expect(createAlert).toHaveBeenCalledWith(
      expect.objectContaining({ alertType: "renewal-7" }),
    );
  });

  it("fires payment-due-7 when payment is pending and renewal within 7 days", async () => {
    scan.mockResolvedValue([
      sub({
        renewalDate: inDays(5),
        paymentStatus: "pending",
        remindersSent: ["renewal-30", "renewal-15", "renewal-7"],
      }),
    ]);
    await processBillingReminders();
    expect(createAlert).toHaveBeenCalledWith(
      expect.objectContaining({ alertType: "payment-due-7" }),
    );
  });
});

describe("processBillingReminders - idempotency / dedup", () => {
  it("never re-creates an alert rung already in reminders_sent", async () => {
    scan.mockResolvedValue([
      sub({ renewalDate: inDays(29), remindersSent: ["renewal-30"] }),
    ]);
    const r = await processBillingReminders();
    expect(createAlert).not.toHaveBeenCalled();
    expect(r.alertsCreated).toBe(0);
  });

  it("skips a subscription that already has a renewal decision", async () => {
    scan.mockResolvedValue([
      sub({ renewalDate: inDays(5), renewalDecision: "renew" }),
    ]);
    const r = await processBillingReminders();
    expect(createAlert).not.toHaveBeenCalled();
    expect(r.alertsCreated).toBe(0);
  });

  it("emails the owner when one is set and records the marker", async () => {
    scan.mockResolvedValue([
      sub({
        renewalDate: inDays(29),
        owner: { name: "Owner", email: "owner@x.com" },
      }),
    ]);
    const r = await processBillingReminders();
    expect(r.emailsSent).toBe(1);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          remindersSent: expect.arrayContaining(["renewal-30"]),
        }),
      }),
    );
  });
});
