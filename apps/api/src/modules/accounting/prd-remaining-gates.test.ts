import { Prisma } from "@nexora/database";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { BadRequestException } from "@/common/exceptions/http-exception";
import { prisma } from "@/infrastructure/database/prisma";
import { accountingRepository } from "@/modules/accounting/accounting.repository";
import { accountingService } from "@/modules/accounting/accounting.service";
import * as accountingFx from "@/modules/accounting/accounting-fx.service";
import { postMoneyEvent } from "@/modules/accounting/cash-posting.service";
import * as glPosting from "@/modules/accounting/gl-posting.service";
import * as numbering from "@/modules/accounting/numbering.service";

vi.mock("@/modules/accounting/accounting.repository", () => ({
  accountingRepository: {
    // Second-level approval is OFF unless a setting row says otherwise, so a
    // null here is the shipped default and the send path is unaffected.
    getSecondApprovalSetting: vi.fn().mockResolvedValue(null),
    findSameDayDocuments: vi.fn().mockResolvedValue([]),
    updateInvoiceApproval: vi.fn(),
    getEntitySetupState: vi.fn(),
    findTaxFiling: vi.fn(),
    findInvoiceByEntityAndNo: vi.fn(),
    createInvoice: vi.fn(),
    findInvoiceById: vi.fn(),
    findEntitySetup: vi.fn(),
    findAccountMappings: vi.fn(),
    updateInvoice: vi.fn(),
  },
}));

vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
    fileUpload: { findMany: vi.fn() },
  },
}));

vi.mock("@/modules/accounting/accounting.locks", () => ({
  assertPostingPeriodOpen: vi.fn(),
  paymentReconciled: vi.fn(),
}));

vi.mock("@/modules/accounting/cash-posting.service", () => ({
  postMoneyEvent: vi.fn(),
}));

vi.mock("@/modules/accounting/accounting.flags", () => ({
  isGlPostingEnabled: () => true,
  isSettlementV2Enabled: () => false,
}));

vi.mock("@/modules/accounting/numbering.service", async () => {
  const actual = await vi.importActual<typeof numbering>(
    "@/modules/accounting/numbering.service",
  );
  return {
    ...actual,
    allocateDraftNumber: vi.fn(),
    allocateDocumentNumber: vi.fn(),
  };
});

vi.mock("@/modules/accounting/accounting-fx.service", async () => {
  const actual = await vi.importActual<typeof accountingFx>(
    "@/modules/accounting/accounting-fx.service",
  );
  return {
    ...actual,
    resolveAccountingFx: vi.fn(),
  };
});

vi.mock("@/modules/accounting/gl-posting.service", async () => {
  const actual = await vi.importActual<typeof glPosting>(
    "@/modules/accounting/gl-posting.service",
  );
  return {
    ...actual,
    resolveMappedAccount: vi.fn(),
    findMappedAccount: vi.fn(),
  };
});

const $transaction = prisma.$transaction as unknown as Mock;
const fileUploadFindMany = prisma.fileUpload.findMany as unknown as Mock;
const postMoneyEventMock = postMoneyEvent as unknown as Mock;
const resolveMappedAccountMock =
  glPosting.resolveMappedAccount as unknown as Mock;
const findMappedAccountMock = glPosting.findMappedAccount as unknown as Mock;
const allocateDocumentNumberMock =
  numbering.allocateDocumentNumber as unknown as Mock;
const resolveAccountingFxMock =
  accountingFx.resolveAccountingFx as unknown as Mock;
const findInvoiceById = accountingRepository.findInvoiceById as Mock;
const findEntitySetup = accountingRepository.findEntitySetup as Mock;
const findAccountMappings = accountingRepository.findAccountMappings as Mock;

const tx = {
  $queryRaw: vi.fn(),
  invoice: { findUnique: vi.fn(), update: vi.fn() },
  payment: { create: vi.fn(), update: vi.fn(), aggregate: vi.fn() },
  bankAccount: { findFirst: vi.fn() },
};

function lineMemo(
  lines: glPosting.PostingLine[],
  accountId: string,
  memo: string,
) {
  return lines.find((l) => l.accountId === accountId && l.memo === memo);
}

beforeEach(() => {
  vi.clearAllMocks();
  (accountingRepository.getEntitySetupState as Mock).mockResolvedValue(
    "active",
  );
  (accountingRepository.findTaxFiling as Mock).mockResolvedValue(null);
  findEntitySetup.mockResolvedValue({ id: "ent-1", currency: "THB" });
  findAccountMappings.mockResolvedValue(
    glPosting.REQUIRED_MAPPING_ROLES.map((role) => ({ role })),
  );
  allocateDocumentNumberMock.mockImplementation(
    async (_tx: unknown, _entityId: string, type: string) => {
      if (type === "invoice") return "INV202608001";
      if (type === "bill") return "EXP202608001";
      if (type === "receipt") return "RCP202608001";
      return "DOC-1";
    },
  );
  resolveAccountingFxMock.mockImplementation(
    async (_ccy: string, _date: Date, side: "buying" | "selling") => ({
      rate: new Prisma.Decimal(1),
      rateDate: "2026-08-19",
      side,
      source: "spot",
    }),
  );
  resolveMappedAccountMock.mockImplementation(
    async (_tx: unknown, _entityId: string, role: string) => `acct-${role}`,
  );
  findMappedAccountMock.mockImplementation(
    async (_tx: unknown, _entityId: string, role: string) => {
      if (role === "vat_output_deferred") return "acct-vat_output_deferred";
      if (role === "vat_input_deferred") return "acct-vat_input_deferred";
      return null;
    },
  );
  postMoneyEventMock.mockResolvedValue({ id: "je-1", entryNo: "JE-1" });
  tx.invoice.findUnique.mockResolvedValue(null);
  tx.invoice.update.mockResolvedValue({});
  tx.payment.create.mockResolvedValue({ id: "pay-1" });
  tx.payment.update.mockResolvedValue({});
  tx.payment.aggregate.mockResolvedValue({ _sum: { vatRecognised: 0 } });
  tx.bankAccount.findFirst.mockResolvedValue({
    id: "bank-1",
    entityId: "ent-1",
    glAccountId: "gl-bank",
  });
  $transaction.mockImplementation(async (fn: (t: typeof tx) => unknown) =>
    fn(tx),
  );
  fileUploadFindMany.mockResolvedValue([
    { mimeType: "application/pdf", size: 1200 },
  ]);
});

function draftPayable() {
  return {
    id: "inv-1",
    entityId: "ent-1",
    invoiceNo: "DRAFT-INV-000001",
    draftNo: "DRAFT-INV-000001",
    type: "payable",
    status: "draft",
    counterparty: "Vendor Co",
    amount: 1070,
    amountPaid: 0,
    currency: "THB",
    vatRate: 7,
    taxRate: 0,
    whtRate: 0,
    headerDiscount: 0,
    roundingAmount: 0,
    exchangeRate: 1,
    baseAmount: 1070,
    taxInvoiceReceived: false,
    issueDate: new Date("2026-08-10T00:00:00.000Z"),
    createdBy: "user-1",
    linkedJeId: null,
    lineItems: [
      {
        description: "Service",
        quantity: 1,
        unitPrice: 1000,
        lineDiscount: 0,
        vatRate: 7,
        glAccountId: null,
      },
    ],
  };
}

describe("PRD remaining gates", () => {
  it("send without attachment throws", async () => {
    findInvoiceById.mockResolvedValue({
      ...draftPayable(),
      type: "receivable",
    });
    fileUploadFindMany.mockResolvedValue([]);

    await expect(
      accountingService.updateInvoiceStatus("inv-1", "sent", "user-1", []),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(postMoneyEventMock).not.toHaveBeenCalled();
  });

  it("void after payment throws (credit-note path)", async () => {
    findInvoiceById.mockResolvedValue({
      ...draftPayable(),
      type: "receivable",
      invoiceNo: "INV202608001",
      status: "sent",
      amountPaid: 1070,
      linkedJeId: "je-1",
    });

    await expect(
      accountingService.updateInvoiceStatus("inv-1", "cancelled", "user-1", []),
    ).rejects.toThrow(/credit note/i);
    expect(postMoneyEventMock).not.toHaveBeenCalled();
  });

  it("payable send without taxInvoiceReceived debits deferred input VAT memo", async () => {
    const invoice = draftPayable();
    findInvoiceById.mockResolvedValue(invoice);

    await accountingService.updateInvoiceStatus("inv-1", "sent", "user-1", []);

    const lines = postMoneyEventMock.mock.calls[0][1].posting
      .lines as glPosting.PostingLine[];
    expect(
      lineMemo(lines, "acct-vat_input_deferred", "Deferred Input VAT")?.debit,
    ).toEqual(new Prisma.Decimal(70));
    expect(lineMemo(lines, "acct-vat_input", "Input VAT")).toBeUndefined();
  });

  it("bankFee appears on payment lines", async () => {
    const invoice = {
      ...draftPayable(),
      type: "receivable",
      invoiceNo: "INV202608001",
      status: "sent",
      taxInvoiceReceived: false,
    };
    findInvoiceById.mockResolvedValue(invoice);
    tx.invoice.findUnique.mockResolvedValue(invoice);

    await accountingService.recordPayment(
      "user-1",
      "inv-1",
      {
        bankAccountId: "bank-1",
        date: "2026-08-20",
        amount: 1070,
        bankFee: 25,
        whtAmount: 0,
        method: "bank-transfer",
      },
      [],
    );

    const lines = postMoneyEventMock.mock.calls[0][1].posting
      .lines as glPosting.PostingLine[];
    expect(lineMemo(lines, "acct-bank_charges", "Bank fee")?.debit).toEqual(
      new Prisma.Decimal(25),
    );
    expect(lineMemo(lines, "gl-bank", "Bank fee")?.credit).toEqual(
      new Prisma.Decimal(25),
    );
    expect(tx.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ bankFee: 25 }),
      }),
    );
  });

  it("syncAccountingFxRates upserts a row", async () => {
    const upsert = vi.fn();
    const result = await accountingFx.syncAccountingFxRates({
      listMidRates: async () => [
        {
          currency: "USD",
          effectiveDate: new Date("2026-08-19T00:00:00.000Z"),
          rate: new Prisma.Decimal("32.1"),
          source: "bot",
        },
      ],
      upsert,
    });
    expect(result.upserted).toBe(1);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        currency: "USD",
        buyingRate: new Prisma.Decimal("32.1"),
        sellingRate: new Prisma.Decimal("32.1"),
        source: "bot",
      }),
    );
  });
});
