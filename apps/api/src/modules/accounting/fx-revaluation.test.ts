import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import {
  BadRequestException,
  ConflictException,
} from "@/common/exceptions/http-exception";
import { prisma } from "@/infrastructure/database/prisma";
import { accountingRepository } from "@/modules/accounting/accounting.repository";
import { accountingService } from "@/modules/accounting/accounting.service";
import { postMoneyEvent } from "@/modules/accounting/cash-posting.service";
import * as glPosting from "@/modules/accounting/gl-posting.service";
import { createExchangeRateService } from "@/modules/exchange-rates/exchange-rates.service";

vi.mock("@/modules/accounting/accounting.repository", () => ({
  accountingRepository: {
    findEntitySetup: vi.fn(),
    findAccountMappings: vi.fn(),
    findRevaluationEntry: vi.fn(),
    findOpenInvoicesForRevaluation: vi.fn(),
    findBankAccountsForRevaluation: vi.fn(),
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
}));

vi.mock("@/modules/exchange-rates/exchange-rates.service", () => ({
  createExchangeRateService: vi.fn(),
}));

// Keep the real balance helpers; replace only the mapping resolver.
vi.mock("@/modules/accounting/gl-posting.service", async () => {
  const actual = await vi.importActual<typeof glPosting>(
    "@/modules/accounting/gl-posting.service",
  );
  return { ...actual, resolveMappedAccount: vi.fn() };
});

const $transaction = prisma.$transaction as unknown as Mock;
const postMoneyEventMock = postMoneyEvent as unknown as Mock;
const createDraftJe = vi.fn(async ({ data }: { data: { status: string; sourceType: string; entryNo: string } }) => ({
  id: "je-draft-1",
  entryNo: data.entryNo,
  status: data.status,
  sourceType: data.sourceType,
}));
const resolveMappedAccountMock =
  glPosting.resolveMappedAccount as unknown as Mock;
const createFx = createExchangeRateService as unknown as Mock;
const findEntitySetup = accountingRepository.findEntitySetup as Mock;
const findAccountMappings = accountingRepository.findAccountMappings as Mock;
const findRevaluationEntry = accountingRepository.findRevaluationEntry as Mock;
const findOpenInvoicesForRevaluation =
  accountingRepository.findOpenInvoicesForRevaluation as Mock;
const findBankAccountsForRevaluation =
  accountingRepository.findBankAccountsForRevaluation as Mock;

function line(lines: glPosting.PostingLine[], accountId: string) {
  return lines.find((l) => l.accountId === accountId);
}

beforeEach(() => {
  vi.resetAllMocks();
  $transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
    fn({
      documentSequence: {
        findFirst: async () => null,
        findUnique: async () => null,
        upsert: async () => ({
          prefix: "DRAFT-",
          nextNumber: 2,
          padWidth: 6,
        }),
      },
      journalEntry: { create: createDraftJe },
    }),
  );
  createDraftJe.mockClear();
  resolveMappedAccountMock.mockImplementation(
    async (_tx: unknown, _entityId: string, role: string) => `acct-${role}`,
  );
  postMoneyEventMock.mockResolvedValue({ id: "je-1", entryNo: "JE-1" });
  findEntitySetup.mockResolvedValue({ id: "ent-1", currency: "THB" });
  // shouldPost() needs all REQUIRED roles mapped (+ the flag, mocked true).
  findAccountMappings.mockResolvedValue(
    glPosting.REQUIRED_MAPPING_ROLES.map((role) => ({ role })),
  );
  findRevaluationEntry.mockResolvedValue(null);
  findOpenInvoicesForRevaluation.mockResolvedValue([]);
  findBankAccountsForRevaluation.mockResolvedValue([]);
  // Closing rate USD→THB = 32.
  createFx.mockReturnValue({
    resolveRate: vi.fn().mockResolvedValue({ rate: 32, source: "direct" }),
  });
});

const REVAL = { entityId: "ent-1", year: 2026, month: 8 };

describe("AccountingService.runFxRevaluation", () => {
  it("books an unrealised GAIN on an open foreign receivable as a draft with no reversal", async () => {
    // USD receivable, outstanding 1000, booked @30, closing @32 → +2000 base.
    findOpenInvoicesForRevaluation.mockResolvedValue([
      {
        id: "inv-1",
        invoiceNo: "INV-1",
        type: "receivable",
        currency: "USD",
        amount: 1000,
        amountPaid: 0,
        exchangeRate: 30,
        issueDate: new Date("2026-08-10T00:00:00.000Z"),
      },
    ]);

    const result = await accountingService.runFxRevaluation("user-1", REVAL);

    expect(postMoneyEventMock).not.toHaveBeenCalled();
    expect(createDraftJe).toHaveBeenCalledTimes(1);
    const created = createDraftJe.mock.calls[0][0].data as unknown as {
      status: string;
      sourceType: string;
      date: Date;
      lines: { createMany: { data: Array<{ accountId: string; debit: number; credit: number }> } };
    };
    expect(created.status).toBe("draft");
    expect(created.sourceType).toBe("fx-revaluation");
    expect(created.date.toISOString().slice(0, 10)).toBe("2026-08-31");
    const lines = created.lines.createMany.data.map((l) => ({
      accountId: l.accountId,
      debit: l.debit,
      credit: l.credit,
    }));
    expect(line(lines, "acct-ar_control")?.debit).toBe(2000);
    expect(line(lines, "acct-fx_gain")?.credit).toBe(2000);
    expect(result).toMatchObject({
      itemsRevalued: 1,
      netFx: 2000,
      reversalEntryId: null,
    });
  });

  it("books an unrealised LOSS on an open foreign payable", async () => {
    // USD payable, outstanding 500, booked @30, closing @32 → owe +1000 base.
    findOpenInvoicesForRevaluation.mockResolvedValue([
      {
        id: "bill-1",
        invoiceNo: "BILL-1",
        type: "payable",
        currency: "USD",
        amount: 500,
        amountPaid: 0,
        exchangeRate: 30,
        issueDate: new Date("2026-08-05T00:00:00.000Z"),
      },
    ]);

    const result = await accountingService.runFxRevaluation("user-1", REVAL);

    expect(postMoneyEventMock).not.toHaveBeenCalled();
    const rows = (
      createDraftJe.mock.calls[0][0].data as unknown as {
        lines: { createMany: { data: glPosting.PostingLine[] } };
      }
    ).lines.createMany.data;
    expect(line(rows, "acct-ap_control")?.credit).toBe(1000);
    expect(line(rows, "acct-fx_loss")?.debit).toBe(1000);
    expect(result).toMatchObject({ itemsRevalued: 1, netFx: -1000 });
  });

  it("revalues a foreign bank balance against its GL carrying value", async () => {
    // USD bank: current balance 1000 @ closing 32 = 32000 base; GL carries
    // 30000 → +2000 unrealised gain on the bank GL account.
    findBankAccountsForRevaluation.mockResolvedValue([
      {
        id: "bank-1",
        name: "USD Operating",
        currency: "USD",
        currentBalance: 1000,
        glAccountId: "gl-bank-usd",
        glAccount: { id: "gl-bank-usd", balance: 30000 },
      },
    ]);

    const result = await accountingService.runFxRevaluation("user-1", REVAL);

    expect(postMoneyEventMock).not.toHaveBeenCalled();
    const rows = (
      createDraftJe.mock.calls[0][0].data as unknown as {
        lines: { createMany: { data: glPosting.PostingLine[] } };
      }
    ).lines.createMany.data;
    expect(line(rows, "gl-bank-usd")?.debit).toBe(2000);
    expect(line(rows, "acct-fx_gain")?.credit).toBe(2000);
    expect(result).toMatchObject({ itemsRevalued: 1, netFx: 2000 });
  });

  it("does nothing when there are no open foreign monetary items", async () => {
    findOpenInvoicesForRevaluation.mockResolvedValue([
      // A base-currency (THB) invoice is not a foreign monetary item.
      {
        id: "inv-thb",
        invoiceNo: "INV-THB",
        type: "receivable",
        currency: "THB",
        amount: 1000,
        amountPaid: 0,
        exchangeRate: 1,
        issueDate: new Date("2026-08-10T00:00:00.000Z"),
      },
    ]);

    const result = await accountingService.runFxRevaluation("user-1", REVAL);

    expect(postMoneyEventMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({ itemsRevalued: 0, entryId: null });
  });

  it("is idempotent — refuses a second revaluation for the same period", async () => {
    findRevaluationEntry.mockResolvedValue({ id: "je-x", entryNo: "JE-9" });

    await expect(
      accountingService.runFxRevaluation("user-1", REVAL),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(postMoneyEventMock).not.toHaveBeenCalled();
  });

  it("requires GL posting to be ready (mapping complete)", async () => {
    findAccountMappings.mockResolvedValue([]); // mapping incomplete → shouldPost false

    await expect(
      accountingService.runFxRevaluation("user-1", REVAL),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(postMoneyEventMock).not.toHaveBeenCalled();
  });
});
