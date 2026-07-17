import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { BadRequestException } from "@/common/exceptions/http-exception";
import { createSignedUrl } from "@/infrastructure/storage/supabase-storage";
import { expenseItemsService } from "@/modules/expenses/expense-items.service";
import { expenseReportsService } from "@/modules/expenses/expense-reports.service";
import {
  validateExpenseReceiptUrl,
  withSignedReceipts,
} from "@/modules/expenses/expense-shared";

const OWNER_ID = "00000000-0000-4000-8000-000000000001";
const OTHER_ID = "00000000-0000-4000-8000-000000000002";
const REPORT_ID = "00000000-0000-4000-8000-000000000003";
const EXPENSE_ID = "00000000-0000-4000-8000-000000000004";
const RECEIPT_URL =
  "https://manut.supabase.co/storage/v1/object/sign/receipts/expenses/receipt.pdf?token=temporary";
const DOCUMENT_URL =
  "https://manut.supabase.co/storage/v1/object/sign/documents/legal/contract.pdf?token=temporary";
const FOREIGN_URL =
  "https://attacker.example/storage/v1/object/sign/receipts/expenses/receipt.pdf?token=temporary";
const EXTERNAL_URL = "https://receipts.example/invoice/123";

const storageMocks = vi.hoisted(() => {
  const previousNextPublicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousSupabaseUrl = process.env.SUPABASE_URL;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://manut.supabase.co";
  process.env.SUPABASE_URL = "https://manut.supabase.co";

  return {
    createSignedUrl: vi.fn(),
    previousNextPublicUrl,
    previousSupabaseUrl,
  };
});

const prismaMock = vi.hoisted(() => ({
  expense: { create: vi.fn() },
  expenseApprovalDecision: { findFirst: vi.fn() },
  fileUpload: { findFirst: vi.fn() },
  travelRequest: { findUnique: vi.fn() },
  user: { findUnique: vi.fn() },
}));

const repositoryMock = vi.hoisted(() => ({
  convertAmount: vi.fn(),
  createExpense: vi.fn(),
  findCategoryById: vi.fn(),
  findExpenseById: vi.fn(),
  findReportById: vi.fn(),
  findReportExpenseLines: vi.fn(),
  sumReportTotalsByCurrency: vi.fn(),
  updateExpense: vi.fn(),
}));

vi.mock("@/infrastructure/database/prisma", () => ({ prisma: prismaMock }));

vi.mock("@/infrastructure/storage/supabase-storage", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, createSignedUrl: storageMocks.createSignedUrl };
});

vi.mock("@/infrastructure/email/email.service", () => ({
  sendEmail: vi.fn(),
}));

vi.mock("@/lib/events", () => ({
  actorFromId: vi.fn().mockResolvedValue(null),
  trackExpenseApproved: vi.fn(),
  trackExpenseSubmittedServer: vi.fn(),
}));

vi.mock("@/modules/expenses/expenses.repository", () => ({
  expensesRepository: repositoryMock,
}));

type UploadRecord = {
  bucket: string;
  path: string;
  purpose: string;
  uploadedBy: string;
};

let uploadRecords: UploadRecord[] = [];

function addReceiptUpload(overrides: Partial<UploadRecord> = {}): void {
  uploadRecords.push({
    bucket: "receipts",
    path: "expenses/receipt.pdf",
    purpose: "expense-receipt",
    uploadedBy: OWNER_ID,
    ...overrides,
  });
}

afterAll(() => {
  if (storageMocks.previousNextPublicUrl === undefined) {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  } else {
    process.env.NEXT_PUBLIC_SUPABASE_URL = storageMocks.previousNextPublicUrl;
  }
  if (storageMocks.previousSupabaseUrl === undefined) {
    delete process.env.SUPABASE_URL;
  } else {
    process.env.SUPABASE_URL = storageMocks.previousSupabaseUrl;
  }
});

beforeEach(() => {
  vi.clearAllMocks();
  uploadRecords = [];
  prismaMock.fileUpload.findFirst.mockImplementation(
    async (args: {
      where: {
        bucket: string;
        path: string;
        purpose: string;
        uploadedBy: string;
      };
    }) => {
      const match = uploadRecords.find(
        (record) =>
          record.bucket === args.where.bucket &&
          record.path === args.where.path &&
          record.purpose === args.where.purpose &&
          record.uploadedBy === args.where.uploadedBy,
      );
      return match ? { id: "upload-1" } : null;
    },
  );
  prismaMock.user.findUnique.mockResolvedValue(null);
  storageMocks.createSignedUrl.mockResolvedValue(
    "https://manut.supabase.co/signed/receipt",
  );
  repositoryMock.findCategoryById.mockResolvedValue(null);
  repositoryMock.sumReportTotalsByCurrency.mockResolvedValue([]);
  repositoryMock.findReportExpenseLines.mockResolvedValue([]);
});

describe("expense receipt provenance", () => {
  it("allows an ordinary external URL without using storage credentials", async () => {
    await expect(
      validateExpenseReceiptUrl(EXTERNAL_URL, OWNER_ID),
    ).resolves.toBeNull();

    expect(prismaMock.fileUpload.findFirst).not.toHaveBeenCalled();
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it.each([
    ["a foreign Supabase-shaped origin", FOREIGN_URL],
    ["the documents bucket", DOCUMENT_URL],
  ])("rejects %s", async (_case, url) => {
    await expect(validateExpenseReceiptUrl(url, OWNER_ID)).rejects.toThrow(
      BadRequestException,
    );

    expect(prismaMock.fileUpload.findFirst).not.toHaveBeenCalled();
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it("rejects a receipts object uploaded by another employee", async () => {
    addReceiptUpload({ uploadedBy: OTHER_ID });

    await expect(
      validateExpenseReceiptUrl(RECEIPT_URL, OWNER_ID),
    ).rejects.toThrow(BadRequestException);
  });

  it("rejects a receipts object registered for another purpose", async () => {
    addReceiptUpload({ purpose: "cash-advance-receipt" });

    await expect(
      validateExpenseReceiptUrl(RECEIPT_URL, OWNER_ID),
    ).rejects.toThrow(BadRequestException);
  });

  it("accepts only the employee's registered expense receipt", async () => {
    addReceiptUpload();

    await expect(
      validateExpenseReceiptUrl(RECEIPT_URL, OWNER_ID),
    ).resolves.toEqual({
      bucket: "receipts",
      path: "expenses/receipt.pdf",
    });
    expect(prismaMock.fileUpload.findFirst).toHaveBeenCalledWith({
      where: {
        bucket: "receipts",
        path: "expenses/receipt.pdf",
        purpose: "expense-receipt",
        uploadedBy: OWNER_ID,
      },
      select: { id: true },
    });
  });
});

describe("expense receipt write paths", () => {
  const createInput = {
    entityId: "entity-1",
    description: "Taxi",
    amount: 450,
    currency: "THB",
    date: "2026-07-17",
    receiptUrl: RECEIPT_URL,
  };

  it("validates a receipt before creating an individual expense", async () => {
    addReceiptUpload();
    repositoryMock.createExpense.mockResolvedValue({
      id: EXPENSE_ID,
      employeeId: OWNER_ID,
      ...createInput,
      category: null,
    });

    await expenseItemsService.createExpense(OWNER_ID, createInput);

    expect(prismaMock.fileUpload.findFirst).toHaveBeenCalledOnce();
    expect(repositoryMock.createExpense).toHaveBeenCalledOnce();
  });

  it("rejects a documents URL before updating an individual expense", async () => {
    repositoryMock.findExpenseById.mockResolvedValue({
      id: EXPENSE_ID,
      employeeId: OWNER_ID,
      status: "pending",
    });

    await expect(
      expenseItemsService.updateExpense(EXPENSE_ID, OWNER_ID, {
        receiptUrl: DOCUMENT_URL,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(repositoryMock.updateExpense).not.toHaveBeenCalled();
  });

  it("rejects a foreign Supabase URL before adding a report expense", async () => {
    repositoryMock.findReportById.mockResolvedValue({
      id: REPORT_ID,
      employeeId: OWNER_ID,
      entityId: "entity-1",
      status: "draft",
    });

    await expect(
      expenseReportsService.addExpenseToReport(REPORT_ID, OWNER_ID, {
        ...createInput,
        receiptUrl: FOREIGN_URL,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prismaMock.expense.create).not.toHaveBeenCalled();
  });

  it("rejects another employee's receipt before updating a report expense", async () => {
    addReceiptUpload({ uploadedBy: OTHER_ID });
    repositoryMock.findReportById.mockResolvedValue({
      id: REPORT_ID,
      employeeId: OWNER_ID,
      status: "draft",
    });
    repositoryMock.findExpenseById.mockResolvedValue({
      id: EXPENSE_ID,
      employeeId: OWNER_ID,
      reportId: REPORT_ID,
    });

    await expect(
      expenseReportsService.updateExpenseInReport(
        REPORT_ID,
        EXPENSE_ID,
        OWNER_ID,
        { receiptUrl: RECEIPT_URL },
      ),
    ).rejects.toThrow(BadRequestException);
    expect(repositoryMock.updateExpense).not.toHaveBeenCalled();
  });
});

describe("expense receipt signed read paths", () => {
  it("signs an explicit receipt only after validating employee provenance", async () => {
    addReceiptUpload();
    repositoryMock.findExpenseById.mockResolvedValue({
      id: EXPENSE_ID,
      employeeId: OWNER_ID,
      receiptUrl: RECEIPT_URL,
    });

    await expect(
      expenseItemsService.getExpenseReceiptUrl(EXPENSE_ID, OWNER_ID, []),
    ).resolves.toEqual({
      url: "https://manut.supabase.co/signed/receipt",
    });
    expect(createSignedUrl).toHaveBeenCalledWith(
      "receipts",
      "expenses/receipt.pdf",
      300,
    );
  });

  it("does not proxy a legal document through the explicit receipt route", async () => {
    repositoryMock.findExpenseById.mockResolvedValue({
      id: EXPENSE_ID,
      employeeId: OWNER_ID,
      receiptUrl: DOCUMENT_URL,
    });

    await expect(
      expenseItemsService.getExpenseReceiptUrl(EXPENSE_ID, OWNER_ID, []),
    ).rejects.toThrow(BadRequestException);
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it("validates ownership before signing receipts in report lists", async () => {
    addReceiptUpload({ uploadedBy: OTHER_ID });

    await expect(
      withSignedReceipts([
        {
          id: EXPENSE_ID,
          employeeId: OWNER_ID,
          receiptUrl: RECEIPT_URL,
        },
      ]),
    ).rejects.toThrow(BadRequestException);
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it("signs valid report-list receipts and passes external links through", async () => {
    addReceiptUpload();

    await expect(
      withSignedReceipts([
        {
          id: EXPENSE_ID,
          employeeId: OWNER_ID,
          receiptUrl: RECEIPT_URL,
        },
        {
          id: "external-expense",
          employeeId: OWNER_ID,
          receiptUrl: EXTERNAL_URL,
        },
      ]),
    ).resolves.toEqual([
      {
        id: EXPENSE_ID,
        employeeId: OWNER_ID,
        receiptUrl: "https://manut.supabase.co/signed/receipt",
      },
      {
        id: "external-expense",
        employeeId: OWNER_ID,
        receiptUrl: EXTERNAL_URL,
      },
    ]);
    expect(createSignedUrl).toHaveBeenCalledOnce();
  });
});
