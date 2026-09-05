import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/infrastructure/database/prisma";
import { sendEmail } from "@/infrastructure/email/email.service";
import {
  currentExpensePeriodBangkok,
  expenseReminderVariantForEntityCode,
  expensesService,
  isExpenseReminderDayBangkok,
} from "@/modules/expenses/expenses.service";

vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    user: { findMany: vi.fn() },
    expenseReport: { findMany: vi.fn() },
    systemSetting: { findUnique: vi.fn() },
  },
}));

vi.mock("@/infrastructure/email/email.service", () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

const sendEmailMock = vi.mocked(sendEmail);
const findUsers = vi.mocked(prisma.user.findMany);
const findReports = vi.mocked(prisma.expenseReport.findMany);

describe("expense monthly submission reminders", () => {
  const service = expensesService;

  beforeEach(() => {
    sendEmailMock.mockClear();
    // Provide safe defaults so tests that don't configure these mocks still
    // get an empty array instead of undefined (which crashes on .length).
    // Specific tests override these with mockResolvedValue.
    findUsers.mockReset();
    findReports.mockReset();
    findUsers.mockResolvedValue([]);
    findReports.mockResolvedValue([]);
  });

  it("maps entity codes to reminder variants", () => {
    expect(expenseReminderVariantForEntityCode("TH")).toBe("thailand");
    expect(expenseReminderVariantForEntityCode("IN")).toBe("international");
    expect(expenseReminderVariantForEntityCode(null)).toBe("international");
  });

  it("skips when not the 22nd unless force is set", async () => {
    const notTwentySecond = new Date("2026-05-21T02:00:00.000Z");
    expect(isExpenseReminderDayBangkok(notTwentySecond)).toBe(false);

    const result = await service.processMonthlySubmissionReminders({
      force: false,
    });

    if (isExpenseReminderDayBangkok(new Date())) {
      expect(result).not.toMatchObject({
        skipped: true,
        reason: "not_reminder_day",
      });
    } else {
      expect(result).toEqual({
        skipped: true,
        reason: "not_reminder_day",
        dayOfMonth: expect.any(Number),
        period: currentExpensePeriodBangkok(new Date()),
      });
      expect(findUsers).not.toHaveBeenCalled();
    }
  });

  it("emails eligible users who have not filed for the period", async () => {
    findUsers.mockResolvedValue([
      {
        id: "u-th",
        name: "Thai User",
        email: "thai@example.com",
        entity: { code: "TH", name: "TBH Thailand" },
      },
      {
        id: "u-in",
        name: "India User",
        email: "india@example.com",
        entity: { code: "IN", name: "TBH India" },
      },
    ] as never);
    findReports.mockResolvedValue([{ employeeId: "u-in" }] as never);

    const result = await service.processMonthlySubmissionReminders({
      force: true,
    });

    expect(result).toMatchObject({
      skipped: false,
      thailandReminders: 1,
      internationalReminders: 0,
      emailsSent: 1,
      alreadyFiled: 1,
      failed: 0,
      eligible: 2,
    });
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const call = sendEmailMock.mock.calls[0]![0] as {
      to: string;
      subject: string;
    };
    expect(call.to).toBe("thai@example.com");
    expect(call.subject).toContain("allowance");
  });
});
