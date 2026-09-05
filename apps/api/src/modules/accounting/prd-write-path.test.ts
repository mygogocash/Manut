import { Prisma } from "@nexora/database";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

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
    approveJournal: vi.fn(),
    findJournalById: vi.fn(),
    findJournalsCreatedBy: vi.fn(),
    getMakerCheckerSetting: vi.fn(),
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
const allocateDraftNumberMock =
  numbering.allocateDraftNumber as unknown as Mock;
const allocateDocumentNumberMock =
  numbering.allocateDocumentNumber as unknown as Mock;
const resolveAccountingFxMock =
  accountingFx.resolveAccountingFx as unknown as Mock;
const getEntitySetupState = accountingRepository.getEntitySetupState as Mock;
const findTaxFiling = accountingRepository.findTaxFiling as Mock;
const findInvoiceByEntityAndNo =
  accountingRepository.findInvoiceByEntityAndNo as Mock;
const createInvoiceRepo = accountingRepository.createInvoice as Mock;
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
  getEntitySetupState.mockResolvedValue("active");
  findTaxFiling.mockResolvedValue(null);
  findInvoiceByEntityAndNo.mockResolvedValue(null);
  createInvoiceRepo.mockImplementation(async (data: { invoiceNo: string }) => ({
    id: "inv-1",
    ...data,
  }));
  findEntitySetup.mockResolvedValue({ id: "ent-1", currency: "THB" });
  findAccountMappings.mockResolvedValue(
    glPosting.REQUIRED_MAPPING_ROLES.map((role) => ({ role })),
  );
  allocateDraftNumberMock.mockResolvedValue("DRAFT-INV-000001");
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
      rate: new Prisma.Decimal(side === "buying" ? 32.1 : 32.4),
      rateDate: "2026-08-19",
      side,
      source: "spot",
    }),
  );
  resolveMappedAccountMock.mockImplementation(
    async (_tx: unknown, _entityId: string, role: string) => `acct-${role}`,
  );
  findMappedAccountMock.mockImplementation(
    async (_tx: unknown, _entityId: string, role: string) =>
      role === "vat_output_deferred" ? "acct-vat_output_deferred" : null,
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

const arLines = [
  {
    description: "Service A",
    quantity: 1,
    unitPrice: 1000,
    lineDiscount: 100,
    vatRate: 7,
  },
  {
    description: "Service B",
    quantity: 1,
    unitPrice: 500,
    vatRate: 0,
  },
];

describe("PRD write path — createInvoice", () => {
  it("allocates DRAFT-INV, uses computeArDocument, and stores satang rounding", async () => {
    await accountingService.createInvoice(
      {
        entityId: "ent-1",
        type: "receivable",
        counterparty: "ACME",
        currency: "THB",
        vatRate: 7,
        taxRate: 0,
        whtRate: 0,
        headerDiscount: 50,
        userTotal: 1411,
        issueDate: "2026-08-10",
        dueDate: "2026-08-31",
        lineItems: arLines,
      },
      "user-1",
    );

    expect(allocateDraftNumberMock).toHaveBeenCalledWith(
      tx,
      "ent-1",
      "invoice",
    );
    expect(createInvoiceRepo).toHaveBeenCalledWith(
      expect.objectContaining({
        invoiceNo: "DRAFT-INV-000001",
        draftNo: "DRAFT-INV-000001",
        amount: 1411,
        roundingAmount: 0.25,
        headerDiscount: 50,
        createdBy: "user-1",
      }),
    );
    const storedLines = createInvoiceRepo.mock.calls[0][0].lineItems;
    expect(storedLines[0].taxBase).toBe(867.86);
    expect(storedLines[0].vatAmount).toBe(60.75);
  });

  it("books AR at the BOT buying rate and AP at the selling rate", async () => {
    await accountingService.createInvoice(
      {
        entityId: "ent-1",
        type: "receivable",
        counterparty: "ACME US",
        currency: "USD",
        vatRate: 0,
        taxRate: 0,
        whtRate: 0,
        issueDate: "2026-08-10",
        dueDate: "2026-08-31",
        lineItems: [{ description: "Fee", quantity: 1, unitPrice: 100 }],
      },
      "user-1",
    );
    expect(resolveAccountingFxMock).toHaveBeenCalledWith(
      "USD",
      expect.any(Date),
      "buying",
    );
    expect(createInvoiceRepo).toHaveBeenCalledWith(
      expect.objectContaining({
        exchangeRate: 32.1,
        fxSide: "buying",
        baseAmount: 3210,
      }),
    );

    resolveAccountingFxMock.mockClear();
    createInvoiceRepo.mockClear();
    await accountingService.createInvoice(
      {
        entityId: "ent-1",
        type: "payable",
        counterparty: "Vendor US",
        currency: "USD",
        vatRate: 0,
        taxRate: 0,
        whtRate: 0,
        issueDate: "2026-08-10",
        dueDate: "2026-08-31",
        lineItems: [{ description: "Bill", quantity: 1, unitPrice: 100 }],
      },
      "user-1",
    );
    expect(resolveAccountingFxMock).toHaveBeenCalledWith(
      "USD",
      expect.any(Date),
      "selling",
    );
    expect(createInvoiceRepo).toHaveBeenCalledWith(
      expect.objectContaining({
        exchangeRate: 32.4,
        fxSide: "selling",
        baseAmount: 3240,
      }),
    );
  });
});

describe("PRD write path — send + collect", () => {
  function draftInvoice() {
    return {
      id: "inv-1",
      entityId: "ent-1",
      invoiceNo: "DRAFT-INV-000001",
      draftNo: "DRAFT-INV-000001",
      type: "receivable",
      status: "draft",
      counterparty: "ACME",
      amount: 1070,
      amountPaid: 0,
      currency: "THB",
      vatRate: 7,
      taxRate: 0,
      whtRate: 0,
      headerDiscount: 0,
      roundingAmount: 0,
      exchangeRate: 1,
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

  it("allocates INV on send and credits deferred output VAT, not vat_output", async () => {
    const invoice = draftInvoice();
    findInvoiceById.mockResolvedValue(invoice);

    await accountingService.updateInvoiceStatus("inv-1", "sent", "user-1", []);

    expect(allocateDocumentNumberMock).toHaveBeenCalledWith(
      tx,
      "ent-1",
      "invoice",
      invoice.issueDate,
    );
    expect(postMoneyEventMock).toHaveBeenCalledTimes(1);
    const lines = postMoneyEventMock.mock.calls[0][1].posting
      .lines as glPosting.PostingLine[];
    expect(
      lineMemo(lines, "acct-vat_output_deferred", "Deferred Output VAT")
        ?.credit,
    ).toEqual(new Prisma.Decimal(70));
    expect(lineMemo(lines, "acct-vat_output", "Output VAT")).toBeUndefined();
    expect(tx.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "sent",
          invoiceNo: "INV202608001",
          linkedJeId: "je-1",
        }),
      }),
    );
  });

  it("recognises deferred → output VAT on recordPayment", async () => {
    const invoice = {
      ...draftInvoice(),
      invoiceNo: "INV202608001",
      status: "sent",
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
        whtAmount: 0,
        method: "bank-transfer",
      },
      [],
    );

    expect(allocateDocumentNumberMock).toHaveBeenCalledWith(
      tx,
      "ent-1",
      "receipt",
      expect.any(Date),
    );
    expect(tx.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          receiptNo: "RCP202608001",
          vatRecognised: 70,
        }),
      }),
    );
    const lines = postMoneyEventMock.mock.calls[0][1].posting
      .lines as glPosting.PostingLine[];
    expect(
      lineMemo(
        lines,
        "acct-vat_output_deferred",
        "Recognise output VAT on collection",
      )?.debit,
    ).toEqual(new Prisma.Decimal(70));
    expect(lineMemo(lines, "acct-vat_output", "Output VAT")?.credit).toEqual(
      new Prisma.Decimal(70),
    );
  });
});
