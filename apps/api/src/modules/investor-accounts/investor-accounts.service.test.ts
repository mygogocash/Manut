import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { PERMISSIONS } from "@/common/constants/permissions";
import { NotFoundException } from "@/common/exceptions/http-exception";
import { investorAccountRepository } from "@/modules/investor-accounts/investor-accounts.repository";
import { InvestorAccountService } from "@/modules/investor-accounts/investor-accounts.service";

vi.mock("@/modules/investor-accounts/investor-accounts.repository", () => ({
  investorAccountRepository: {
    findMany: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

const findMany = investorAccountRepository.findMany as Mock;
const findById = investorAccountRepository.findById as Mock;
const USER_ID = "u-1";
const service = new InvestorAccountService();

beforeEach(() => {
  vi.resetAllMocks();
  findMany.mockResolvedValue({ data: [], total: 0 });
});

describe("InvestorAccountService ownership scoping", () => {
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

  it("does not scope list with investors:read-all", async () => {
    await service.list(USER_ID, [PERMISSIONS.INVESTORS_READ_ALL], {
      page: 1,
      limit: 20,
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ ownerScope: undefined }),
      1,
      20,
    );
  });

  it("hides another owner's account from a non-read-all caller", async () => {
    findById.mockResolvedValue({ id: "a-1", ownerId: "other" });
    await expect(
      service.getById("a-1", USER_ID, [PERMISSIONS.INVESTORS_READ]),
    ).rejects.toThrow(NotFoundException);
  });
});
