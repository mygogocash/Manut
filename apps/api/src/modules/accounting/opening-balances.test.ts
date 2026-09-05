import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@/common/exceptions/http-exception";
import { prisma } from "@/infrastructure/database/prisma";
import { accountingRepository } from "@/modules/accounting/accounting.repository";
import { accountingService } from "@/modules/accounting/accounting.service";
import type { ImportOpeningBalancesInput } from "@/modules/accounting/accounting.validation";
import * as glPosting from "@/modules/accounting/gl-posting.service";

vi.mock("@/modules/accounting/accounting.repository", () => ({
  accountingRepository: {
    findEntitySetup: vi.fn(),
    hasOpeningEntry: vi.fn(),
    findOpeningEntry: vi.fn(),
    findActiveAccountIds: vi.fn(),
  },
}));

vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: { $transaction: vi.fn() },
}));

vi.mock("@/modules/accounting/accounting.locks", () => ({
  assertPostingPeriodOpen: vi.fn(),
  paymentReconciled: vi.fn(),
}));

// Keep the pure balance helpers (normalizeLines / computeEntryTotals) real;
// replace only the DB-touching poster + mapping resolver so the balance check
// is genuinely exercised while the transaction stays in-memory.
vi.mock("@/modules/accounting/gl-posting.service", async () => {
  const actual = await vi.importActual<typeof glPosting>(
    "@/modules/accounting/gl-posting.service",
  );
  return {
    ...actual,
    postBalancedEntry: vi.fn(),
    resolveMappedAccount: vi.fn(),
  };
});

const $transaction = prisma.$transaction as unknown as Mock;
const postBalancedEntryMock = glPosting.postBalancedEntry as unknown as Mock;
const resolveMappedAccountMock =
  glPosting.resolveMappedAccount as unknown as Mock;
const findEntitySetup = accountingRepository.findEntitySetup as Mock;
const hasOpeningEntry = accountingRepository.hasOpeningEntry as Mock;
const findOpeningEntry = accountingRepository.findOpeningEntry as Mock;
const findActiveAccountIds = accountingRepository.findActiveAccountIds as Mock;

function baseInput(
  overrides: Partial<ImportOpeningBalancesInput> = {},
): ImportOpeningBalancesInput {
  return {
    entityId: "ent-1",
    asOfDate: new Date("2026-01-01T00:00:00.000Z"),
    accounts: [],
    openReceivables: [],
    openPayables: [],
    bankBalances: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  // Run the transaction callback synchronously against a stub tx — the
  // resolver + poster are mocked and ignore it.
  $transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
    fn({}),
  );
  resolveMappedAccountMock.mockImplementation(
    async (_tx: unknown, _entityId: string, role: string) => `acct-${role}`,
  );
  postBalancedEntryMock.mockResolvedValue({
    id: "je-open-1",
    entryNo: "JE-000001",
  });
  findEntitySetup.mockResolvedValue({ id: "ent-1", setupState: "setup" });
  hasOpeningEntry.mockResolvedValue(false);
  findActiveAccountIds.mockResolvedValue([]);
});

describe("AccountingService.importOpeningBalances", () => {
  it("posts exactly one opening JE with the expected AR/AP/OBE/bank routing", async () => {
    findActiveAccountIds.mockResolvedValue([
      "acct-fixed",
      "acct-equity",
      "acct-bank",
    ]);

    const result = await accountingService.importOpeningBalances(
      "user-1",
      baseInput({
        accounts: [
          { chartOfAccountId: "acct-fixed", debit: 100 },
          { chartOfAccountId: "acct-equity", credit: 100 },
        ],
        openReceivables: [
          { counterpartyName: "Cust A", amount: 50 },
          { counterpartyName: "Cust B", amount: 30 },
        ],
        openPayables: [{ counterpartyName: "Sup X", amount: 20 }],
        bankBalances: [{ chartOfAccountId: "acct-bank", amount: 200 }],
      }),
    );

    // Routed through the GL engine exactly once.
    expect(postBalancedEntryMock).toHaveBeenCalledTimes(1);
    const req = postBalancedEntryMock.mock
      .calls[0][1] as glPosting.PostingRequest;

    expect(req.sourceType).toBe("opening");
    expect(req.sourceRef).toBe("ent-1");
    expect(req.createdBy).toBe("user-1");
    expect(req.description).toBe("Opening balances as of 2026-01-01");

    const lines = req.lines;
    // AR net 80: Dr ar_control.
    expect(lines.find((l) => l.accountId === "acct-ar_control")?.debit).toBe(
      80,
    );
    // AP net 20: Cr ap_control.
    expect(lines.find((l) => l.accountId === "acct-ap_control")?.credit).toBe(
      20,
    );
    // Bank 200: Dr the bank GL account.
    expect(lines.find((l) => l.accountId === "acct-bank")?.debit).toBe(200);

    // opening_balance_equity is the plug: Cr 80 (AR) + Cr 200 (bank), Dr 20 (AP).
    const obeLines = lines.filter(
      (l) => l.accountId === "acct-opening_balance_equity",
    );
    const obeCredits = obeLines
      .filter((l) => l.credit != null)
      .map((l) => l.credit);
    const obeDebits = obeLines
      .filter((l) => l.debit != null)
      .map((l) => l.debit);
    expect(obeCredits).toEqual(expect.arrayContaining([80, 200]));
    expect(obeDebits).toEqual(expect.arrayContaining([20]));

    expect(result).toMatchObject({
      entryId: "je-open-1",
      entryNo: "JE-000001",
      entityId: "ent-1",
    });
  });

  it("posts a plain trial balance without requiring opening_balance_equity", async () => {
    findActiveAccountIds.mockResolvedValue(["acct-fixed", "acct-equity"]);

    await accountingService.importOpeningBalances(
      "user-1",
      baseInput({
        accounts: [
          { chartOfAccountId: "acct-fixed", debit: 100 },
          { chartOfAccountId: "acct-equity", credit: 100 },
        ],
      }),
    );

    // No AR/AP/bank leg → the OBE mapping is never resolved.
    expect(resolveMappedAccountMock).not.toHaveBeenCalled();
    expect(postBalancedEntryMock).toHaveBeenCalledTimes(1);
  });

  it("rejects an unbalanced set with a 400 that reports the difference, and posts nothing", async () => {
    findActiveAccountIds.mockResolvedValue(["acct-fixed"]);

    let err: unknown;
    try {
      await accountingService.importOpeningBalances(
        "user-1",
        baseInput({
          accounts: [{ chartOfAccountId: "acct-fixed", debit: 100 }],
        }),
      );
    } catch (e) {
      err = e;
    }

    expect(err).toBeInstanceOf(BadRequestException);
    expect((err as Error).message).toMatch(/difference/i);
    expect(postBalancedEntryMock).not.toHaveBeenCalled();
  });

  it("refuses a second import for an entity that already has an opening entry (Conflict)", async () => {
    hasOpeningEntry.mockResolvedValue(true);

    await expect(
      accountingService.importOpeningBalances(
        "user-1",
        baseInput({
          accounts: [
            { chartOfAccountId: "acct-fixed", debit: 100 },
            { chartOfAccountId: "acct-equity", credit: 100 },
          ],
        }),
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    expect($transaction).not.toHaveBeenCalled();
    expect(postBalancedEntryMock).not.toHaveBeenCalled();
  });

  it("surfaces AccountMappingMissingError when a required role is unmapped", async () => {
    findActiveAccountIds.mockResolvedValue(["acct-bank"]);
    resolveMappedAccountMock.mockRejectedValue(
      new glPosting.AccountMappingMissingError("opening_balance_equity"),
    );

    await expect(
      accountingService.importOpeningBalances(
        "user-1",
        baseInput({
          bankBalances: [{ chartOfAccountId: "acct-bank", amount: 200 }],
        }),
      ),
    ).rejects.toBeInstanceOf(glPosting.AccountMappingMissingError);

    expect(postBalancedEntryMock).not.toHaveBeenCalled();
  });

  it("rejects an opening line that posts to a foreign or inactive account", async () => {
    findActiveAccountIds.mockResolvedValue(["acct-fixed"]);

    await expect(
      accountingService.importOpeningBalances(
        "user-1",
        baseInput({
          accounts: [
            { chartOfAccountId: "acct-foreign", debit: 100 },
            { chartOfAccountId: "acct-fixed", credit: 100 },
          ],
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(postBalancedEntryMock).not.toHaveBeenCalled();
  });

  it("404s on an unknown entity", async () => {
    findEntitySetup.mockResolvedValue(null);

    await expect(
      accountingService.importOpeningBalances(
        "user-1",
        baseInput({ accounts: [{ chartOfAccountId: "x", debit: 1 }] }),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("AccountingService.getOpeningBalanceStatus", () => {
  it("reports exists=false when no opening entry is present", async () => {
    findOpeningEntry.mockResolvedValue(null);

    const status = await accountingService.getOpeningBalanceStatus({
      entityId: "ent-1",
    });

    expect(status).toMatchObject({
      entityId: "ent-1",
      exists: false,
      entry: null,
    });
  });

  it("reports exists=true with the entry summary when present", async () => {
    findOpeningEntry.mockResolvedValue({
      id: "je-open-1",
      entryNo: "JE-000001",
    });

    const status = await accountingService.getOpeningBalanceStatus({
      entityId: "ent-1",
    });

    expect(status.exists).toBe(true);
    expect(status.entry).toMatchObject({ id: "je-open-1" });
  });

  it("404s on an unknown entity", async () => {
    findEntitySetup.mockResolvedValue(null);

    await expect(
      accountingService.getOpeningBalanceStatus({ entityId: "nope" }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
