import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { PERMISSIONS } from "@/common/constants/permissions";
import { NotFoundException } from "@/common/exceptions/http-exception";
import { investorAccountRepository } from "@/modules/investor-accounts/investor-accounts.repository";
import { investorContactRepository } from "@/modules/investor-contacts/investor-contacts.repository";
import { InvestorContactService } from "@/modules/investor-contacts/investor-contacts.service";
import { mockArgument } from "@/test-utils/assertions";

vi.mock("@/modules/investor-contacts/investor-contacts.repository", () => ({
  investorContactRepository: {
    findMany: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("@/modules/investor-accounts/investor-accounts.repository", () => ({
  investorAccountRepository: { findById: vi.fn() },
}));

const findMany = investorContactRepository.findMany as Mock;
const findById = investorContactRepository.findById as Mock;
const update = investorContactRepository.update as Mock;
const accountFindById = investorAccountRepository.findById as Mock;
const USER_ID = "u-1";
const service = new InvestorContactService();

beforeEach(() => {
  vi.resetAllMocks();
  findMany.mockResolvedValue({ data: [], total: 0 });
  accountFindById.mockResolvedValue({ id: "acc-9", ownerId: USER_ID });
});

describe("InvestorContactService ownership scoping", () => {
  it("scopes list to the caller without investors:read-all", async () => {
    await service.list(USER_ID, [PERMISSIONS.INVESTORS_READ], {
      page: 1,
      limit: 20,
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ ownerScope: [USER_ID] }),
      1,
      20,
    );
  });

  it("hides another owner's contact from a non-read-all caller", async () => {
    findById.mockResolvedValue({ id: "c-1", ownerId: "other" });
    await expect(
      service.getById("c-1", USER_ID, [PERMISSIONS.INVESTORS_READ]),
    ).rejects.toThrow(NotFoundException);
  });
});

describe("InvestorContactService.update — account link", () => {
  it("disconnects the account when accountId is null", async () => {
    findById.mockResolvedValue({ id: "c-1", ownerId: USER_ID });
    update.mockResolvedValue({ id: "c-1" });
    await service.update("c-1", USER_ID, [PERMISSIONS.INVESTORS_READ_ALL], {
      accountId: null,
    });
    expect(mockArgument(update.mock.calls, 0, 1)).toMatchObject({
      account: { disconnect: true },
    });
  });

  it("connects the account when accountId is a string", async () => {
    findById.mockResolvedValue({ id: "c-1", ownerId: USER_ID });
    update.mockResolvedValue({ id: "c-1" });
    await service.update("c-1", USER_ID, [PERMISSIONS.INVESTORS_READ_ALL], {
      accountId: "acc-9",
    });
    expect(mockArgument(update.mock.calls, 0, 1)).toMatchObject({
      account: { connect: { id: "acc-9" } },
    });
  });

  it("rejects linking to an account the caller cannot access (IDOR)", async () => {
    findById.mockResolvedValue({ id: "c-1", ownerId: USER_ID });
    accountFindById.mockResolvedValue({ id: "acc-9", ownerId: "someone-else" });
    await expect(
      service.update("c-1", USER_ID, [PERMISSIONS.INVESTORS_READ], {
        accountId: "acc-9",
      }),
    ).rejects.toThrow(NotFoundException);
    expect(update).not.toHaveBeenCalled();
  });
});
