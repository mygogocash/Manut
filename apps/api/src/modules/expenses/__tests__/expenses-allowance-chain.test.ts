import { beforeEach, describe, expect, it, vi } from "vitest";

import { expensesService } from "@/modules/expenses/expenses.service";
import { mockArgument } from "@/test-utils/assertions";

/**
 * IT-15 — Allowance approval chain routing.
 *
 * Verifies that `ExpensesService.submitReport` chooses the right path
 * for allowance-only reports based on whether an allowance approval
 * chain is configured:
 *
 *   * Chain configured  →  category override to "allowance", report
 *                          enters the snapshot flow as `submitted`.
 *   * Chain absent      →  legacy fast-path: status flips straight to
 *                          `reimbursed` and a finance-desk FYI is sent.
 *   * Mixed report      →  neither path; generic manager chain.
 */

const MEAL_CAT = "cat-meal";
const TRANSPORT_CAT = "cat-transport";
const NON_ALLOWANCE_CAT = "cat-office";

const ACTOR_ID = "00000000-0000-0000-0000-000000000001";
const EMPLOYEE_ID = ACTOR_ID;
const REPORT_ID = "11111111-1111-1111-1111-111111111111";
const ENTITY_ID = "22222222-2222-2222-2222-222222222222";

const prismaMock = vi.hoisted(() => {
  const txTemplate = {
    expenseReport: { update: vi.fn() },
    expense: { updateMany: vi.fn() },
  };
  return {
    tx: txTemplate,
    $transaction: vi.fn(
      async (fn: (t: typeof txTemplate) => Promise<unknown>) => fn(txTemplate),
    ),
    user: { findUnique: vi.fn() },
    expenseCategory: { findMany: vi.fn() },
    expenseApprovalDecision: { update: vi.fn() },
    systemSetting: { findUnique: vi.fn().mockResolvedValue(null) },
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

vi.mock("@/infrastructure/email/templates", () => ({
  expenseAllowanceFiledEmail: vi.fn().mockReturnValue({
    subject: "Allowance filed",
    html: "",
  }),
  expenseSubmittedEmail: vi.fn().mockReturnValue({
    subject: "Submitted",
    html: "",
  }),
  expenseApprovedEmail: vi.fn().mockReturnValue({
    subject: "Approved",
    html: "",
  }),
  expenseRejectedEmail: vi.fn().mockReturnValue({
    subject: "Rejected",
    html: "",
  }),
  expenseReimbursedEmail: vi.fn().mockReturnValue({
    subject: "Reimbursed",
    html: "",
  }),
  expenseDeskSummaryEmail: vi.fn().mockReturnValue({
    subject: "Desk summary",
    html: "",
  }),
}));

const repositoryMock = vi.hoisted(() => ({
  findReportById: vi.fn(),
  findApprovalSteps: vi.fn(),
  findDecisions: vi.fn(),
  deleteDecisionsForReport: vi.fn().mockResolvedValue(undefined),
  createDecisions: vi.fn().mockResolvedValue(undefined),
  updateReport: vi.fn(),
  sumReportTotal: vi.fn().mockResolvedValue(1000),
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

function makeReport(
  expenses: Array<{ categoryId: string | null; currency?: string }>,
  overrides: Record<string, unknown> = {},
) {
  return {
    id: REPORT_ID,
    employeeId: EMPLOYEE_ID,
    entityId: ENTITY_ID,
    period: "2026-05",
    title: "May 2026 Allowance",
    category: "general",
    status: "draft",
    notes: null,
    expenses: expenses.map((e, i) => ({
      id: `exp-${i}`,
      categoryId: e.categoryId,
      amount: 1000,
      currency: e.currency ?? "THB",
      description: `line ${i}`,
    })),
    ...overrides,
  };
}

function setAllowanceCategories(ids: string[]) {
  prismaMock.expenseCategory.findMany.mockResolvedValue(
    ids.map((id) => ({ id, isAllowance: true })),
  );
}

function setMixedCategories(idsByFlag: Record<string, boolean>) {
  prismaMock.expenseCategory.findMany.mockResolvedValue(
    Object.entries(idsByFlag).map(([id, isAllowance]) => ({ id, isAllowance })),
  );
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
    name: "Submitter",
    email: "s@example.com",
    reportingTo: null,
  });
  repositoryMock.findDecisions.mockResolvedValue([]);
});

describe("ExpensesService.submitReport — allowance routing (IT-15)", () => {
  it("blocks submit when a foreign line has no THB exchange rate", async () => {
    // A plain (non-allowance) IDR expense, and no IDR→THB rate on file.
    repositoryMock.findReportById.mockResolvedValue(
      makeReport([{ categoryId: null, currency: "IDR" }]),
    );
    repositoryMock.findReportExpenseLines.mockResolvedValueOnce([
      { amount: 400110, currency: "IDR", date: new Date("2026-06-03") },
    ]);
    repositoryMock.convertAmount.mockResolvedValueOnce(null);

    await expect(
      expensesService.submitReport(REPORT_ID, ACTOR_ID),
    ).rejects.toThrow(/exchange rate for IDR/);

    // The report must NOT have flipped to submitted.
    const submitted = repositoryMock.updateReport.mock.calls.find(
      (c) => (c[1] as Record<string, unknown>).status === "submitted",
    );
    expect(submitted).toBeUndefined();
  });

  it("routes allowance-only reports through the chain when configured", async () => {
    repositoryMock.findReportById.mockResolvedValue(
      makeReport([{ categoryId: MEAL_CAT }, { categoryId: TRANSPORT_CAT }]),
    );
    setAllowanceCategories([MEAL_CAT, TRANSPORT_CAT]);

    // Allowance chain present: one step with categoryFilter ["allowance"].
    repositoryMock.findApprovalSteps.mockResolvedValue([
      {
        id: "step-100",
        order: 100,
        name: "Allowance — First Approval",
        approverType: "user",
        approverUserId: null,
        skipWhenSubmitterIds: [],
        onlyWhenSubmitterIds: [],
        categoryFilter: ["allowance"],
        amountMinBaht: null,
        amountMaxBaht: null,
        isActive: true,
      },
    ]);

    await expensesService.submitReport(REPORT_ID, ACTOR_ID);

    const updateCalls = repositoryMock.updateReport.mock.calls;
    // First call: override category to "allowance" before snapshotting.
    expect(updateCalls[0]?.[1]).toMatchObject({ category: "allowance" });
    // Second call: submit the report (status flips to "submitted",
    // NOT "reimbursed"). currentStepOrder seeded at 1.
    const submitUpdate = updateCalls.find(
      (c) => (c[1] as Record<string, unknown>).status === "submitted",
    );
    expect(submitUpdate).toBeTruthy();
    expect(submitUpdate?.[1]).toMatchObject({
      status: "submitted",
      currentStepOrder: 1,
    });
    // The legacy fast-path would have set status="reimbursed" — it must
    // not appear among the writes when the chain is configured.
    const reimbursedUpdate = updateCalls.find(
      (c) => (c[1] as Record<string, unknown>).status === "reimbursed",
    );
    expect(reimbursedUpdate).toBeUndefined();

    // Decision snapshot was created (chain was actually invoked).
    expect(repositoryMock.createDecisions).toHaveBeenCalledTimes(1);
  });

  it("falls back to the legacy fast-path when no allowance chain exists", async () => {
    repositoryMock.findReportById.mockResolvedValue(
      makeReport([{ categoryId: MEAL_CAT }]),
    );
    setAllowanceCategories([MEAL_CAT]);

    // No step has "allowance" in its categoryFilter — chain not
    // configured. Service must short-circuit to `reimbursed`.
    repositoryMock.findApprovalSteps.mockResolvedValue([
      {
        id: "step-1",
        order: 1,
        name: "Direct Manager",
        approverType: "manager",
        approverUserId: null,
        skipWhenSubmitterIds: [],
        onlyWhenSubmitterIds: [],
        categoryFilter: ["general", "business_or_bd"],
        amountMinBaht: null,
        amountMaxBaht: null,
        isActive: true,
      },
    ]);
    prismaMock.tx.expenseReport.update.mockResolvedValue({
      id: REPORT_ID,
      employee: { id: EMPLOYEE_ID, name: "Submitter", email: "s@example.com" },
    });
    prismaMock.tx.expense.updateMany.mockResolvedValue({ count: 1 });

    await expensesService.submitReport(REPORT_ID, ACTOR_ID);

    // Fast-path runs the report transition inside prisma.$transaction
    // and sets status="reimbursed" on both the report and its lines.
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    const reportTxCall = mockArgument(
      prismaMock.tx.expenseReport.update.mock.calls,
      0,
      0,
    );
    expect(reportTxCall.data).toMatchObject({
      status: "reimbursed",
      reimbursedAt: expect.any(Date),
      currentStepOrder: null,
    });
    expect(prismaMock.tx.expense.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "reimbursed" }),
      }),
    );
    // No category override on the fast-path — the report keeps its
    // original "general" category.
    const categoryOverride = repositoryMock.updateReport.mock.calls.find(
      (c) => (c[1] as Record<string, unknown>).category === "allowance",
    );
    expect(categoryOverride).toBeUndefined();
    // No approval-chain snapshot is created for the fast-path.
    expect(repositoryMock.createDecisions).not.toHaveBeenCalled();
  });

  it("does not touch allowance routing for mixed reports", async () => {
    repositoryMock.findReportById.mockResolvedValue(
      makeReport([{ categoryId: MEAL_CAT }, { categoryId: NON_ALLOWANCE_CAT }]),
    );
    // Mixed: one allowance + one regular category.
    setMixedCategories({
      [MEAL_CAT]: true,
      [NON_ALLOWANCE_CAT]: false,
    });

    // Chain present, but the mixed report should ignore it and use
    // the generic chain so the manager still sees the non-allowance line.
    repositoryMock.findApprovalSteps.mockResolvedValue([
      {
        id: "step-100",
        order: 100,
        name: "Allowance — First Approval",
        approverType: "user",
        approverUserId: "user-approver",
        skipWhenSubmitterIds: [],
        onlyWhenSubmitterIds: [],
        categoryFilter: ["allowance"],
        amountMinBaht: null,
        amountMaxBaht: null,
        isActive: true,
      },
      {
        id: "step-1",
        order: 1,
        name: "Direct Manager",
        approverType: "manager",
        approverUserId: null,
        skipWhenSubmitterIds: [],
        onlyWhenSubmitterIds: [],
        categoryFilter: ["general", "business_or_bd"],
        amountMinBaht: null,
        amountMaxBaht: null,
        isActive: true,
      },
    ]);

    await expensesService.submitReport(REPORT_ID, ACTOR_ID);

    // Category must NOT have been rewritten to "allowance" — mixed
    // reports keep their original category bucket.
    const categoryOverride = repositoryMock.updateReport.mock.calls.find(
      (c) => (c[1] as Record<string, unknown>).category === "allowance",
    );
    expect(categoryOverride).toBeUndefined();
    // Fast-path must not have fired either.
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    // Generic chain ran: at least one decision row was snapshotted.
    expect(repositoryMock.createDecisions).toHaveBeenCalledTimes(1);
  });
});
