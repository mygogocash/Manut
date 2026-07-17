import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  BadRequestException,
  NotFoundException,
} from "@/common/exceptions/http-exception";
import { expensesService } from "@/modules/expenses/expenses.service";
import { mockArgument } from "@/test-utils/assertions";

/**
 * Focused regression test for `ExpensesService.revertReportReimbursement`.
 * Other expense paths are exercised through integration tests in the
 * controller suite (when present); this one guards the new revert flow
 * + its state-machine guard.
 */

const prismaMock = vi.hoisted(() => {
  // `prisma.$transaction(fn)` is invoked with a callback that gets a
  // tx-bound prisma. The mock simulates the transactional client by
  // exposing the same model methods on the tx object passed to the
  // callback.
  const tx = {
    expenseReport: { update: vi.fn() },
    expense: { updateMany: vi.fn() },
  };
  return {
    tx,
    $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) =>
      fn(tx),
    ),
  };
});

vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/infrastructure/supabase/admin", () => ({
  supabaseAdmin: { auth: { admin: {} } },
}));

vi.mock("@/infrastructure/email/email.service", () => ({
  sendEmail: vi.fn(),
}));

const repositoryMock = vi.hoisted(() => ({
  findReportById: vi.fn(),
  sumReportTotal: vi.fn().mockResolvedValue(0),
}));

vi.mock("@/modules/expenses/expenses.repository", () => ({
  expensesRepository: repositoryMock,
}));

const ACTOR_ID = "00000000-0000-0000-0000-000000000001";
const REPORT_ID = "11111111-1111-1111-1111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.tx.expenseReport.update.mockResolvedValue({
    id: REPORT_ID,
    status: "approved",
    reimbursedAt: null,
    employee: { id: "emp", name: "Alice", email: "alice@example.com" },
  });
  prismaMock.tx.expense.updateMany.mockResolvedValue({ count: 1 });
});

describe("ExpensesService.revertReportReimbursement", () => {
  it("flips a reimbursed report back to approved + clears reimbursedAt", async () => {
    repositoryMock.findReportById.mockResolvedValue({
      id: REPORT_ID,
      status: "reimbursed",
      employeeId: "emp",
      expenses: [],
    });

    const result = await expensesService.revertReportReimbursement(
      REPORT_ID,
      ACTOR_ID,
    );

    expect(result.status).toBe("approved");
    expect(result.reimbursedAt).toBeNull();

    const reportUpdateArgs = mockArgument(
      prismaMock.tx.expenseReport.update.mock.calls,
      0,
      0,
    );
    expect(reportUpdateArgs.where).toEqual({ id: REPORT_ID });
    expect(reportUpdateArgs.data.status).toBe("approved");
    expect(reportUpdateArgs.data.reimbursedAt).toBeNull();
    // Approver is intentionally preserved — the revert action does
    // not rewrite the audit trail.
    expect(reportUpdateArgs.data.approvedBy).toBeUndefined();

    const expenseUpdateArgs = mockArgument(
      prismaMock.tx.expense.updateMany.mock.calls,
      0,
      0,
    );
    expect(expenseUpdateArgs.where).toEqual({
      reportId: REPORT_ID,
      status: "reimbursed",
    });
    expect(expenseUpdateArgs.data).toEqual({
      status: "approved",
      reimbursedAt: null,
    });
  });

  it("throws NotFoundException when the report does not exist", async () => {
    repositoryMock.findReportById.mockResolvedValue(null);
    await expect(
      expensesService.revertReportReimbursement(REPORT_ID, ACTOR_ID),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it.each(["draft", "submitted", "approved", "rejected"])(
    "rejects with BadRequestException when status is %s",
    async (status) => {
      repositoryMock.findReportById.mockResolvedValue({
        id: REPORT_ID,
        status,
        employeeId: "emp",
        expenses: [],
      });
      await expect(
        expensesService.revertReportReimbursement(REPORT_ID, ACTOR_ID),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    },
  );
});
