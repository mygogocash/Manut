import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { BadRequestException } from "@/common/exceptions/http-exception";
import { prisma } from "@/infrastructure/database/prisma";
import { isSettlementV2Enabled } from "@/modules/accounting/accounting.flags";
import { accountingRepository } from "@/modules/accounting/accounting.repository";
import { accountingService } from "@/modules/accounting/accounting.service";
import { postMoneyEvent } from "@/modules/accounting/cash-posting.service";
import * as glPosting from "@/modules/accounting/gl-posting.service";
import { createExchangeRateService } from "@/modules/exchange-rates/exchange-rates.service";

vi.mock("@/modules/accounting/accounting.repository", () => ({
  accountingRepository: {
    findEntitySetup: vi.fn(),
    findAccountMappings: vi.fn(),
    findInvoiceById: vi.fn(),
  },
}));

vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: { $transaction: vi.fn() },
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
  isSettlementV2Enabled: vi.fn(() => true),
}));

vi.mock("@/modules/exchange-rates/exchange-rates.service", () => ({
  createExchangeRateService: vi.fn(),
}));

// Keep the real posting builders / balance helpers; replace only the mapping
// resolver so the settlement lines are built for real and must balance.
vi.mock("@/modules/accounting/gl-posting.service", async () => {
  const actual = await vi.importActual<typeof glPosting>(
    "@/modules/accounting/gl-posting.service",
  );
  return { ...actual, resolveMappedAccount: vi.fn() };
});

const $transaction = prisma.$transaction as unknown as Mock;
const postMoneyEventMock = postMoneyEvent as unknown as Mock;
const resolveMappedAccountMock =
  glPosting.resolveMappedAccount as unknown as Mock;
const createFx = createExchangeRateService as unknown as Mock;
const settlementV2 = isSettlementV2Enabled as unknown as Mock;
const findEntitySetup = accountingRepository.findEntitySetup as Mock;
const findAccountMappings = accountingRepository.findAccountMappings as Mock;
const findInvoiceById = accountingRepository.findInvoiceById as Mock;

function invoice(
  id: string,
  no: string,
  amount: number,
  type: "receivable" | "payable" = "receivable",
) {
  return {
    id,
    invoiceNo: no,
    type,
    status: "sent",
    entityId: "ent-1",
    amount,
    amountPaid: 0,
    currency: "THB",
    issueDate: new Date("2026-08-01T00:00:00.000Z"),
    exchangeRate: 1,
    createdBy: "user-1",
  };
}

let db: Record<string, ReturnType<typeof invoice>>;

const tx = {
  invoice: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  payment: {
    create: vi.fn(),
    update: vi.fn(),
    aggregate: vi.fn(),
  },
  paymentAllocation: { create: vi.fn() },
  bankAccount: { findFirst: vi.fn() },
  accountMapping: { findUnique: vi.fn() },
  documentSequence: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
};

// PostingLine.debit/credit are optional number|string|Decimal — coerce.
function sum(
  lines: glPosting.PostingLine[],
  pick: (l: glPosting.PostingLine) => unknown,
) {
  return (
    Math.round(lines.reduce((s, l) => s + Number(pick(l) ?? 0), 0) * 100) / 100
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  settlementV2.mockReturnValue(true);
  db = {
    "inv-1": invoice("inv-1", "INV-1", 100),
    "inv-2": invoice("inv-2", "INV-2", 200),
    // INV-W is net of WHT: net amount 97 (gross AR 100 booked at send, WHT 3).
    "inv-w": invoice("inv-w", "INV-W", 97),
    "bill-1": invoice("bill-1", "BILL-1", 500, "payable"),
  };
  findInvoiceById.mockImplementation(async (id: string) => db[id] ?? null);
  findEntitySetup.mockResolvedValue({ id: "ent-1", currency: "THB" });
  findAccountMappings.mockResolvedValue(
    glPosting.REQUIRED_MAPPING_ROLES.map((role) => ({ role })),
  );
  resolveMappedAccountMock.mockImplementation(
    async (_tx: unknown, _e: string, role: string) => `acct-${role}`,
  );
  postMoneyEventMock.mockResolvedValue({ id: "je-1", entryNo: "JE-1" });
  createFx.mockReturnValue({
    resolveRate: vi.fn().mockResolvedValue({ rate: 1, source: "direct" }),
  });
  tx.invoice.findUnique.mockImplementation(
    async ({ where: { id } }: { where: { id: string } }) => db[id] ?? null,
  );
  tx.invoice.update.mockResolvedValue({});
  tx.payment.create.mockResolvedValue({ id: "pay-1" });
  tx.payment.update.mockResolvedValue({});
  tx.payment.aggregate.mockResolvedValue({
    _sum: { vatRecognised: 0 },
  });
  tx.accountMapping.findUnique.mockResolvedValue(null);
  tx.documentSequence.findFirst.mockResolvedValue(null);
  tx.documentSequence.findUnique.mockResolvedValue(null);
  tx.documentSequence.upsert.mockResolvedValue({
    prefix: "RCP{YYYY}{MM}",
    nextNumber: 2,
    padWidth: 3,
  });
  tx.paymentAllocation.create.mockResolvedValue({});
  tx.bankAccount.findFirst.mockResolvedValue({
    id: "bank-1",
    entityId: "ent-1",
    glAccountId: "gl-bank",
  });
  $transaction.mockImplementation(async (fn: (t: unknown) => unknown) =>
    fn(tx),
  );
});

const baseInput = {
  bankAccountId: "bank-1",
  date: "2026-08-10",
  method: "bank-transfer" as const,
};

describe("AccountingService.recordAllocatedPayment", () => {
  it("refuses when the settlement-v2 flag is off", async () => {
    settlementV2.mockReturnValue(false);
    await expect(
      accountingService.recordAllocatedPayment(
        "user-1",
        {
          ...baseInput,
          allocations: [{ invoiceId: "inv-1", amount: 100, whtAmount: 0 }],
        },
        [],
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.payment.create).not.toHaveBeenCalled();
  });

  it("settles many invoices with one payment and one balanced journal entry", async () => {
    const result = await accountingService.recordAllocatedPayment(
      "user-1",
      {
        ...baseInput,
        allocations: [
          { invoiceId: "inv-1", amount: 100, whtAmount: 0 },
          { invoiceId: "inv-2", amount: 200, whtAmount: 0 },
        ],
      },
      [],
    );

    expect(result).toMatchObject({
      invoicesSettled: 2,
      totalCash: 300,
      totalWht: 0,
      posted: true,
    });

    // One payment for the total cash; one allocation per invoice.
    expect(tx.payment.create).toHaveBeenCalledTimes(1);
    expect(tx.payment.create.mock.calls[0][0].data).toMatchObject({
      amount: 300,
      whtAmount: 0,
    });
    expect(tx.paymentAllocation.create).toHaveBeenCalledTimes(2);
    expect(tx.invoice.update).toHaveBeenCalledTimes(2);

    // One posted entry whose combined lines balance, plus a single bank
    // movement for the total cash received.
    expect(postMoneyEventMock).toHaveBeenCalledTimes(1);
    const arg = postMoneyEventMock.mock.calls[0][1];
    const lines = arg.posting.lines as glPosting.PostingLine[];
    expect(sum(lines, (l) => l.debit)).toBe(300);
    expect(sum(lines, (l) => l.credit)).toBe(300);
    expect(arg.bankMovements[0]).toMatchObject({
      amount: 300,
      direction: "in",
    });
  });

  it("books WHT as a separate leg and settles the invoice with the net cash", async () => {
    // INV-W net amount 97: the customer pays 97 cash and withholds 3. The
    // allocation `amount` is the NET cash (97); WHT (3) is additional.
    const result = await accountingService.recordAllocatedPayment(
      "user-1",
      {
        ...baseInput,
        allocations: [{ invoiceId: "inv-w", amount: 97, whtAmount: 3 }],
      },
      [],
    );

    expect(result).toMatchObject({ totalCash: 97, totalWht: 3 });
    // amountPaid tracks the net cash (97) and clears the net invoice → paid.
    expect(tx.invoice.update.mock.calls[0][0].data).toMatchObject({
      amountPaid: 97,
      status: "paid",
    });

    const lines = postMoneyEventMock.mock.calls[0][1].posting
      .lines as glPosting.PostingLine[];
    // Dr bank 97 + Dr WHT 3 = Cr AR 100 — the gross receivable clears.
    expect(sum(lines, (l) => l.debit)).toBe(sum(lines, (l) => l.credit));
    const ar = lines.find((l) => l.accountId === "acct-ar_control");
    expect(Number(ar?.credit ?? 0)).toBe(100);
    const wht = lines.find((l) => l.accountId === "acct-wht_receivable");
    expect(Number(wht?.debit ?? 0)).toBe(3);
  });

  it("rejects an allocation beyond the invoice's outstanding balance", async () => {
    await expect(
      accountingService.recordAllocatedPayment(
        "user-1",
        {
          ...baseInput,
          allocations: [{ invoiceId: "inv-1", amount: 150, whtAmount: 0 }],
        },
        [],
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.payment.create).not.toHaveBeenCalled();
  });

  it("refuses to mix receivable and payable invoices in one settlement", async () => {
    await expect(
      accountingService.recordAllocatedPayment(
        "user-1",
        {
          ...baseInput,
          allocations: [
            { invoiceId: "inv-1", amount: 100, whtAmount: 0 },
            { invoiceId: "bill-1", amount: 100, whtAmount: 0 },
          ],
        },
        [],
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
