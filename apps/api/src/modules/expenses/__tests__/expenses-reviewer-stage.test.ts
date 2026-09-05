import { beforeEach, describe, expect, it, vi } from "vitest";

import { expensesService } from "@/modules/expenses/expenses.service";

/**
 * Reviewer stage (`stageRole = review | approve`).
 *
 * A `review` step validates and advances the chain but never finalises the
 * report and cannot reduce the approved amount; an `approve` step is the
 * final sign-off gate (today's behaviour). Verifies:
 *
 *   * submit  → the per-report decision snapshot carries each step's
 *               stageRole (review first, approve second).
 *   * approve → a reviewer's accept advances the chain (status stays
 *               `submitted`) and IGNORES any approvedAmount the client sent.
 *   * approve → an approver's accept on the last step finalises (`approved`).
 *   * reject  → a reviewer's reject sends the report back (`rejected`).
 */

const EMPLOYEE_ID = "00000000-0000-0000-0000-000000000001";
const REVIEWER_ID = "00000000-0000-0000-0000-0000000000aa";
const APPROVER_ID = "00000000-0000-0000-0000-0000000000bb";
const REPORT_ID = "11111111-1111-1111-1111-111111111111";

const prismaMock = vi.hoisted(() => {
  const txTemplate = {
    expenseReport: { update: vi.fn() },
    expense: { updateMany: vi.fn() },
    expenseApprovalDecision: { update: vi.fn(), findMany: vi.fn() },
  };
  return {
    tx: txTemplate,
    $transaction: vi.fn(
      async (fn: (t: typeof txTemplate) => Promise<unknown>) => fn(txTemplate),
    ),
    user: { findUnique: vi.fn() },
    expenseCategory: { findMany: vi.fn() },
    expenseApprovalDecision: { findFirst: vi.fn() },
    expenseReport: { update: vi.fn() },
    systemSetting: { findUnique: vi.fn().mockResolvedValue(null) },
  };
});

vi.mock("@/infrastructure/database/prisma", () => ({ prisma: prismaMock }));

vi.mock("@/infrastructure/supabase/admin", () => ({
  supabaseAdmin: { auth: { admin: {} } },
}));

vi.mock("@/infrastructure/email/email.service", () => ({
  sendEmail: vi.fn(),
}));

vi.mock("@/infrastructure/email/templates", () => ({
  expenseAllowanceFiledEmail: vi
    .fn()
    .mockReturnValue({ subject: "", html: "" }),
  expenseSubmittedEmail: vi.fn().mockReturnValue({ subject: "", html: "" }),
  expenseApprovedEmail: vi.fn().mockReturnValue({ subject: "", html: "" }),
  expenseRejectedEmail: vi.fn().mockReturnValue({ subject: "", html: "" }),
  expenseReimbursedEmail: vi.fn().mockReturnValue({ subject: "", html: "" }),
  expenseDeskSummaryEmail: vi.fn().mockReturnValue({ subject: "", html: "" }),
}));

const repositoryMock = vi.hoisted(() => ({
  findReportById: vi.fn(),
  findApprovalSteps: vi.fn(),
  findDecisions: vi.fn(),
  updateDecision: vi.fn().mockResolvedValue(undefined),
  deleteDecisionsForReport: vi.fn().mockResolvedValue(undefined),
  createDecisions: vi.fn().mockResolvedValue(undefined),
  updateReport: vi.fn(),
  sumReportTotalsByCurrency: vi
    .fn()
    .mockResolvedValue([{ currency: "THB", amount: 1000 }]),
  findReportExpenseLines: vi
    .fn()
    .mockResolvedValue([
      { amount: 1000, currency: "THB", date: new Date("2026-05-15") },
    ]),
  convertAmount: vi.fn(),
}));

vi.mock("@/modules/expenses/expenses.repository", () => ({
  expensesRepository: repositoryMock,
}));

function decision(
  order: number,
  stageRole: "review" | "approve",
  approverUserId: string,
  status: "pending" | "approved" | "rejected" = "pending",
) {
  return {
    id: `dec-${order}`,
    expenseReportId: REPORT_ID,
    order,
    name: stageRole === "review" ? "Reviewer" : "Approver",
    approverType: "user",
    stageRole,
    approverUserId,
    status,
    decidedById: null,
    decidedAt: null,
    approvedAmount: null,
    notes: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  repositoryMock.updateReport.mockImplementation(
    async (_id: string, data: Record<string, unknown>) => ({
      id: REPORT_ID,
      ...data,
      employee: { id: EMPLOYEE_ID, name: "Submitter", email: "s@example.com" },
    }),
  );
  prismaMock.user.findUnique.mockResolvedValue({
    name: "Someone",
    email: "someone@example.com",
    reportingTo: null,
  });
  prismaMock.tx.expenseReport.update.mockResolvedValue({
    id: REPORT_ID,
    approvedTotal: null,
    employee: { id: EMPLOYEE_ID, name: "Submitter", email: "s@example.com" },
  });
  prismaMock.tx.expense.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.tx.expenseApprovalDecision.findMany.mockResolvedValue([]);
  prismaMock.expenseReport.update.mockResolvedValue({
    id: REPORT_ID,
    employee: { id: EMPLOYEE_ID, name: "Submitter", email: "s@example.com" },
  });
});

describe("expense reviewer stage — snapshot", () => {
  it("carries each step's stageRole onto the decision rows (review then approve)", async () => {
    repositoryMock.findReportById.mockResolvedValue({
      id: REPORT_ID,
      employeeId: EMPLOYEE_ID,
      title: "May expenses",
      category: "general",
      status: "draft",
      notes: null,
      expenses: [
        { id: "e0", categoryId: null, amount: 600, currency: "THB" },
        { id: "e1", categoryId: null, amount: 400, currency: "THB" },
      ],
    });
    repositoryMock.findApprovalSteps.mockResolvedValue([
      {
        id: "step-review",
        order: 1,
        name: "Reviewer",
        approverType: "user",
        stageRole: "review",
        approverUserId: REVIEWER_ID,
        skipWhenSubmitterIds: [],
        onlyWhenSubmitterIds: [],
        categoryFilter: [],
        amountMinBaht: null,
        amountMaxBaht: null,
        isActive: true,
      },
      {
        id: "step-approve",
        order: 2,
        name: "Approver",
        approverType: "user",
        stageRole: "approve",
        approverUserId: APPROVER_ID,
        skipWhenSubmitterIds: [],
        onlyWhenSubmitterIds: [],
        categoryFilter: [],
        amountMinBaht: null,
        amountMaxBaht: null,
        isActive: true,
      },
    ]);

    await expensesService.submitReport(REPORT_ID, EMPLOYEE_ID);

    expect(repositoryMock.createDecisions).toHaveBeenCalledTimes(1);
    const [, rows] = repositoryMock.createDecisions.mock.calls[0]!;
    expect(rows).toEqual([
      expect.objectContaining({
        order: 1,
        stageRole: "review",
        approverType: "user",
        approverUserId: REVIEWER_ID,
      }),
      expect.objectContaining({
        order: 2,
        stageRole: "approve",
        approverType: "user",
        approverUserId: APPROVER_ID,
      }),
    ]);
  });
});

describe("expense reviewer stage — approve", () => {
  it("reviewer accept advances the chain and ignores any amount override", async () => {
    repositoryMock.findReportById.mockResolvedValue({
      id: REPORT_ID,
      employeeId: EMPLOYEE_ID,
      title: "May expenses",
      category: "general",
      status: "submitted",
      currentStepOrder: 1,
      expenses: [{ id: "e0" }],
    });
    repositoryMock.findDecisions.mockResolvedValue([
      decision(1, "review", REVIEWER_ID),
      decision(2, "approve", APPROVER_ID),
    ]);

    await expensesService.approveReport(REPORT_ID, REVIEWER_ID, [], {
      approvedAmount: 500,
      notes: "looks fine",
    });

    // The reviewer's decision is approved with NO amount haircut.
    const decisionUpdate =
      prismaMock.tx.expenseApprovalDecision.update.mock.calls[0]?.[0];
    expect(decisionUpdate.data).toMatchObject({
      status: "approved",
      approvedAmount: null,
    });
    // Report is NOT finalised — it advances to the approver step.
    const reportUpdate = prismaMock.tx.expenseReport.update.mock.calls[0]?.[0];
    expect(reportUpdate.data).toMatchObject({
      status: "submitted",
      currentStepOrder: 2,
    });
  });

  it("refuses to finalise when a review stage is the last pending step", async () => {
    // Misconfigured chain: a review stage with no approval gate after it.
    // Accepting it must NOT stamp the report approved — it fails closed.
    repositoryMock.findReportById.mockResolvedValue({
      id: REPORT_ID,
      employeeId: EMPLOYEE_ID,
      title: "May expenses",
      category: "general",
      status: "submitted",
      currentStepOrder: 1,
      expenses: [{ id: "e0" }],
    });
    repositoryMock.findDecisions.mockResolvedValue([
      decision(1, "review", REVIEWER_ID),
    ]);

    await expect(
      expensesService.approveReport(REPORT_ID, REVIEWER_ID, [], {}),
    ).rejects.toThrow(/no approval stage after it/);

    // Nothing was finalised.
    expect(prismaMock.tx.expenseReport.update).not.toHaveBeenCalled();
  });

  it("approver accept on the final step finalises the report", async () => {
    repositoryMock.findReportById.mockResolvedValue({
      id: REPORT_ID,
      employeeId: EMPLOYEE_ID,
      title: "May expenses",
      category: "general",
      status: "submitted",
      currentStepOrder: 2,
      expenses: [{ id: "e0" }],
    });
    repositoryMock.findDecisions.mockResolvedValue([
      decision(1, "review", REVIEWER_ID, "approved"),
      decision(2, "approve", APPROVER_ID),
    ]);

    await expensesService.approveReport(REPORT_ID, APPROVER_ID, [], {});

    const reportUpdate = prismaMock.tx.expenseReport.update.mock.calls[0]?.[0];
    expect(reportUpdate.data).toMatchObject({
      status: "approved",
      currentStepOrder: null,
    });
    // Finalising also flips the line items to approved.
    expect(prismaMock.tx.expense.updateMany).toHaveBeenCalled();
  });
});

describe("expense reviewer stage — reject", () => {
  it("reviewer reject sends the report back", async () => {
    repositoryMock.findReportById.mockResolvedValue({
      id: REPORT_ID,
      employeeId: EMPLOYEE_ID,
      title: "May expenses",
      category: "general",
      status: "submitted",
      currentStepOrder: 1,
      expenses: [{ id: "e0" }],
    });
    repositoryMock.findDecisions.mockResolvedValue([
      decision(1, "review", REVIEWER_ID),
      decision(2, "approve", APPROVER_ID),
    ]);

    await expensesService.rejectReport(
      REPORT_ID,
      REVIEWER_ID,
      "missing receipt",
      [],
    );

    // The reviewer's decision row is marked rejected...
    expect(repositoryMock.updateDecision).toHaveBeenCalledWith(
      "dec-1",
      expect.objectContaining({ status: "rejected" }),
    );
    // ...and the whole report flips back to rejected.
    const reportUpdate = prismaMock.expenseReport.update.mock.calls[0]?.[0];
    expect(reportUpdate.data).toMatchObject({
      status: "rejected",
      currentStepOrder: null,
    });
  });
});
