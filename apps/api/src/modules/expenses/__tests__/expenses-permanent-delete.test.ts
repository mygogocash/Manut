import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ConflictException,
  NotFoundException,
} from "@/common/exceptions/http-exception";
import { expenseItemsService } from "@/modules/expenses/expense-items.service";
import { expenseReportsService } from "@/modules/expenses/expense-reports.service";

const repositoryMock = vi.hoisted(() => ({
  findExpenseByIdIncludingDeleted: vi.fn(),
  permanentDeleteExpense: vi.fn(),
  findReportByIdIncludingDeleted: vi.fn(),
  permanentDeleteReport: vi.fn(),
}));

vi.mock("@/modules/expenses/expenses.repository", () => ({
  expensesRepository: repositoryMock,
}));

vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: {},
}));

vi.mock("@/infrastructure/email/email.service", () => ({
  sendEmail: vi.fn(),
}));

vi.mock("@/infrastructure/storage/supabase-storage", () => ({
  createSignedUrl: vi.fn(),
  parseStorageUrl: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("expenseItemsService.permanentDeleteExpense", () => {
  it("purges a soft-deleted expense", async () => {
    const deletedExpense = { id: "expense-1", deletedAt: new Date() };
    repositoryMock.findExpenseByIdIncludingDeleted.mockResolvedValue(
      deletedExpense,
    );
    repositoryMock.permanentDeleteExpense.mockResolvedValue(deletedExpense);

    await expect(
      expenseItemsService.permanentDeleteExpense("expense-1"),
    ).resolves.toBe(deletedExpense);
    expect(repositoryMock.permanentDeleteExpense).toHaveBeenCalledWith(
      "expense-1",
    );
  });

  it("rejects an active expense with conflict", async () => {
    repositoryMock.findExpenseByIdIncludingDeleted.mockResolvedValue({
      id: "expense-1",
      deletedAt: null,
    });

    await expect(
      expenseItemsService.permanentDeleteExpense("expense-1"),
    ).rejects.toThrow(ConflictException);
    expect(repositoryMock.permanentDeleteExpense).not.toHaveBeenCalled();
  });

  it("returns not found when the expense does not exist", async () => {
    repositoryMock.findExpenseByIdIncludingDeleted.mockResolvedValue(null);

    await expect(
      expenseItemsService.permanentDeleteExpense("missing"),
    ).rejects.toThrow(NotFoundException);
    expect(repositoryMock.permanentDeleteExpense).not.toHaveBeenCalled();
  });
});

describe("expenseReportsService.permanentDeleteReport", () => {
  it("purges a soft-deleted report", async () => {
    const deletedReport = { id: "report-1", deletedAt: new Date() };
    repositoryMock.findReportByIdIncludingDeleted.mockResolvedValue(
      deletedReport,
    );
    repositoryMock.permanentDeleteReport.mockResolvedValue(deletedReport);

    await expect(
      expenseReportsService.permanentDeleteReport("report-1"),
    ).resolves.toBe(deletedReport);
    expect(repositoryMock.permanentDeleteReport).toHaveBeenCalledWith(
      "report-1",
    );
  });

  it("rejects an active report with conflict", async () => {
    repositoryMock.findReportByIdIncludingDeleted.mockResolvedValue({
      id: "report-1",
      deletedAt: null,
    });

    await expect(
      expenseReportsService.permanentDeleteReport("report-1"),
    ).rejects.toThrow(ConflictException);
    expect(repositoryMock.permanentDeleteReport).not.toHaveBeenCalled();
  });

  it("returns not found when the report does not exist", async () => {
    repositoryMock.findReportByIdIncludingDeleted.mockResolvedValue(null);

    await expect(
      expenseReportsService.permanentDeleteReport("missing"),
    ).rejects.toThrow(NotFoundException);
    expect(repositoryMock.permanentDeleteReport).not.toHaveBeenCalled();
  });
});
