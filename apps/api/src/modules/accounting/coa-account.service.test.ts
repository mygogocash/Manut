import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { ValidationException } from "@/common/exceptions/http-exception";
import { accountingRepository } from "@/modules/accounting/accounting.repository";
import { accountingService } from "@/modules/accounting/accounting.service";

vi.mock("@/modules/accounting/accounting.repository", () => ({
  accountingRepository: {
    findActiveAccountByEntityAndCode: vi.fn(),
    findInactiveAccountByEntityAndCode: vi.fn(),
    findActiveAccountByNormalizedName: vi.fn(),
    findInactiveAccountByNormalizedName: vi.fn(),
    accountLedgerFacts: vi.fn(),
    isAccountMapped: vi.fn(),
    createAccount: vi.fn(),
    findAccountById: vi.fn(),
    updateAccount: vi.fn(),
  },
}));

vi.mock("@/modules/exchange-rates/exchange-rates.service", () => ({
  createExchangeRateService: vi.fn(),
}));

const findActiveByCode =
  accountingRepository.findActiveAccountByEntityAndCode as Mock;
const findInactiveByCode =
  accountingRepository.findInactiveAccountByEntityAndCode as Mock;
const findActiveByName =
  accountingRepository.findActiveAccountByNormalizedName as Mock;
const findInactiveByName =
  accountingRepository.findInactiveAccountByNormalizedName as Mock;
const ledgerFacts = accountingRepository.accountLedgerFacts as Mock;
const isMapped = accountingRepository.isAccountMapped as Mock;
const createAccount = accountingRepository.createAccount as Mock;
const findAccountById = accountingRepository.findAccountById as Mock;
const updateAccount = accountingRepository.updateAccount as Mock;

const ACTOR = "user-1";

const validInput = {
  entityId: "ent-1",
  code: "1015",
  name: "Cash on Hand Branch Two",
  nameTh: "เงินสดสาขาสอง",
  description: "Till cash at branch two",
  descriptionTh: "เงินสดที่สาขาสอง",
  type: "asset" as const,
};

/** A deactivated account sitting on code 1030, squared off at zero. */
const deadPettyCash = {
  id: "acc-dead",
  code: "1030",
  name: "Petty Cash",
  nameTh: "เงินสดย่อย",
  deactivatedAt: new Date("2026-06-30T00:00:00.000Z"),
};

beforeEach(() => {
  vi.resetAllMocks();
  findActiveByCode.mockResolvedValue(null);
  findInactiveByCode.mockResolvedValue(null);
  findActiveByName.mockResolvedValue(null);
  findInactiveByName.mockResolvedValue(null);
  ledgerFacts.mockResolvedValue({ balance: 0, lastMovementYear: null });
  isMapped.mockResolvedValue(false);
});

describe("AccountingService.createAccount COA integrity", () => {
  it("blocks a duplicate active code and names the colliding account", async () => {
    findActiveByCode.mockResolvedValue({
      code: "1010",
      name: "Cash on Hand",
    });

    await expect(
      accountingService.createAccount({ ...validInput, code: "1010" }, ACTOR),
    ).rejects.toMatchObject({
      status: 422,
      details: [
        expect.objectContaining({
          field: "code",
          message: "Account code already in use: 1010 Cash on Hand",
        }),
      ],
    });
    expect(createAccount).not.toHaveBeenCalled();
  });

  it("blocks a duplicate English name after normalisation", async () => {
    findActiveByName.mockResolvedValue({
      code: "1010",
      name: "Cash on Hand",
    });

    await expect(
      accountingService.createAccount(
        { ...validInput, name: "CASH ON HAND" },
        ACTOR,
      ),
    ).rejects.toBeInstanceOf(ValidationException);
  });

  // The superseded rule warned and saved anyway. PRD 9.1 requires the user to
  // see the warning and accept it first.
  it("refuses an inactive-code reuse until it is acknowledged", async () => {
    findInactiveByCode.mockResolvedValue(deadPettyCash);

    await expect(
      accountingService.createAccount({ ...validInput, code: "1030" }, ACTOR),
    ).rejects.toMatchObject({
      status: 422,
      details: expect.arrayContaining([
        expect.objectContaining({ field: "acknowledgeInactiveReuse" }),
      ]),
    });
    expect(createAccount).not.toHaveBeenCalled();
  });

  it("saves once acknowledged and records which account the code came from", async () => {
    findInactiveByCode.mockResolvedValue(deadPettyCash);
    createAccount.mockResolvedValue({ id: "new", code: "1030" });

    const result = await accountingService.createAccount(
      { ...validInput, code: "1030", acknowledgeInactiveReuse: true },
      ACTOR,
    );

    expect(createAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        reusedFromAccountId: "acc-dead",
        reuseAcknowledgedBy: ACTOR,
      }),
    );
    expect(result.warnings?.[0]?.code).toBe("inactive_code_reuse");
  });

  // The case the whole feature exists for: one code would mean two accounts
  // inside one trial balance.
  it("blocks reuse when the deactivated account still has a balance, even acknowledged", async () => {
    findInactiveByCode.mockResolvedValue({
      ...deadPettyCash,
      id: "acc-1031",
      code: "1031",
      name: "Petty Cash Site A",
    });
    ledgerFacts.mockResolvedValue({ balance: 4500, lastMovementYear: 2026 });

    await expect(
      accountingService.createAccount(
        { ...validInput, code: "1031", acknowledgeInactiveReuse: true },
        ACTOR,
      ),
    ).rejects.toMatchObject({
      status: 422,
      details: expect.arrayContaining([
        expect.objectContaining({
          field: "code",
          message: expect.stringContaining("still has a balance"),
        }),
      ]),
    });
    expect(createAccount).not.toHaveBeenCalled();
  });

  it("blocks reuse of an account still on the financial-statement mapping, zero balance or not", async () => {
    findInactiveByCode.mockResolvedValue(deadPettyCash);
    isMapped.mockResolvedValue(true);

    await expect(
      accountingService.createAccount(
        { ...validInput, code: "1030", acknowledgeInactiveReuse: true },
        ACTOR,
      ),
    ).rejects.toMatchObject({
      details: expect.arrayContaining([
        expect.objectContaining({
          message: expect.stringContaining(
            "mapped in the financial statements",
          ),
        }),
      ]),
    });
  });

  it("reports a code collision and a name collision on two different dead accounts", async () => {
    findInactiveByCode.mockResolvedValue(deadPettyCash);
    findInactiveByName.mockResolvedValue({
      id: "acc-other",
      code: "1099",
      name: "Cash On Hand Branch Two",
      nameTh: null,
      deactivatedAt: null,
    });

    await expect(
      accountingService.createAccount({ ...validInput, code: "1030" }, ACTOR),
    ).rejects.toMatchObject({
      details: expect.arrayContaining([
        expect.objectContaining({ field: "code" }),
        expect.objectContaining({ field: "name" }),
        expect.objectContaining({ field: "acknowledgeInactiveReuse" }),
      ]),
    });
  });
});

describe("AccountingService.updateAccount COA integrity", () => {
  it("does not re-validate an untouched English name that contains digits", async () => {
    findAccountById.mockResolvedValue({
      id: "acc-1",
      entityId: "ent-1",
      code: "1040",
      name: "AR - Trade 01",
      nameTh: "ลูกหนี้",
      description: "Legacy",
      isActive: true,
    });
    updateAccount.mockResolvedValue({ id: "acc-1" });

    await accountingService.updateAccount(
      "acc-1",
      { descriptionTh: "คำอธิบายใหม่" },
      ACTOR,
    );

    expect(updateAccount).toHaveBeenCalled();
  });

  it("validates charset when the English name is edited", async () => {
    findAccountById.mockResolvedValue({
      id: "acc-1",
      entityId: "ent-1",
      code: "1040",
      name: "AR - Trade 01",
      isActive: true,
    });

    await expect(
      accountingService.updateAccount("acc-1", { name: "AR Trade 01" }, ACTOR),
    ).rejects.toBeInstanceOf(ValidationException);
  });

  it("lets a legacy account save a Thai description without filling English description", async () => {
    findAccountById.mockResolvedValue({
      id: "acc-1",
      entityId: "ent-1",
      code: "1040",
      name: "AR - Trade 01",
      nameTh: null,
      description: null,
      descriptionTh: null,
      isActive: true,
    });
    updateAccount.mockResolvedValue({ id: "acc-1" });

    await accountingService.updateAccount(
      "acc-1",
      { descriptionTh: "ลูกหนี้การค้า" },
      ACTOR,
    );

    expect(updateAccount).toHaveBeenCalledWith(
      "acc-1",
      expect.objectContaining({ descriptionTh: "ลูกหนี้การค้า" }),
    );
  });

  it("stamps the deactivation date when an account is switched off", async () => {
    findAccountById.mockResolvedValue({
      id: "acc-1",
      entityId: "ent-1",
      code: "1040",
      name: "Prepaid Rent",
      nameNormalized: "prepaid rent",
      isActive: true,
    });
    updateAccount.mockResolvedValue({ id: "acc-1" });

    await accountingService.updateAccount("acc-1", { isActive: false }, ACTOR);

    expect(updateAccount).toHaveBeenCalledWith(
      "acc-1",
      expect.objectContaining({ deactivatedAt: expect.any(Date) }),
    );
  });

  // PRD 9.1 offers "reactivate the old account" as the way out of a blocked
  // reuse — but not once something else has taken its code.
  it("refuses to reactivate an account whose code a live account now holds", async () => {
    findAccountById.mockResolvedValue({
      id: "acc-dead",
      entityId: "ent-1",
      code: "1030",
      name: "Petty Cash",
      nameNormalized: "petty cash",
      isActive: false,
    });
    findActiveByCode.mockResolvedValue({
      id: "acc-live",
      code: "1030",
      name: "Petty Cash Branch Two",
    });

    await expect(
      accountingService.updateAccount("acc-dead", { isActive: true }, ACTOR),
    ).rejects.toMatchObject({
      status: 422,
      details: expect.arrayContaining([
        expect.objectContaining({ field: "code" }),
      ]),
    });
    expect(updateAccount).not.toHaveBeenCalled();
  });

  it("clears the deactivation date on a clean reactivation", async () => {
    findAccountById.mockResolvedValue({
      id: "acc-dead",
      entityId: "ent-1",
      code: "1030",
      name: "Petty Cash",
      nameNormalized: "petty cash",
      isActive: false,
    });
    updateAccount.mockResolvedValue({ id: "acc-dead" });

    await accountingService.updateAccount(
      "acc-dead",
      { isActive: true },
      ACTOR,
    );

    expect(updateAccount).toHaveBeenCalledWith(
      "acc-dead",
      expect.objectContaining({ deactivatedAt: null }),
    );
  });
});
