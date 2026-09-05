import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { PERMISSIONS } from "@/common/constants/permissions";
import {
  BadRequestException,
  NotFoundException,
} from "@/common/exceptions/http-exception";
import { resolveFundraisingEntityKey } from "@/modules/fundraising-entities/fundraising-entities.service";
import { investorAccountRepository } from "@/modules/investor-accounts/investor-accounts.repository";
import { InvestorAccountService } from "@/modules/investor-accounts/investor-accounts.service";

vi.mock("@/modules/fundraising-entities/fundraising-entities.service", () => ({
  resolveFundraisingEntityKey: vi.fn(),
}));

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
const update = investorAccountRepository.update as Mock;
const resolveEntity = resolveFundraisingEntityKey as Mock;
const USER_ID = "u-1";
const service = new InvestorAccountService();

beforeEach(() => {
  vi.resetAllMocks();
  // Known vehicles resolve; anything else 400s, mirroring the real
  // `resolveFundraisingEntityKey`.
  resolveEntity.mockImplementation((key: string) => {
    if (key !== "tbh" && key !== "tbl") {
      throw new BadRequestException("Unknown fundraising entity");
    }
    return Promise.resolve(key);
  });
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

describe("InvestorAccountService.update — fundraising entity", () => {
  it("writes a resolved entity key", async () => {
    findById.mockResolvedValue({
      id: "a-1",
      ownerId: USER_ID,
      fundraisingEntity: "tbh",
    });
    update.mockResolvedValue({ id: "a-1" });
    await service.update("a-1", USER_ID, [PERMISSIONS.INVESTORS_READ_ALL], {
      fundraisingEntity: "tbl",
    });
    expect(resolveEntity).toHaveBeenCalledWith("tbl");
    expect(update.mock.calls[0][1]).toMatchObject({
      fundraisingEntity: "tbl",
    });
  });

  it("rejects an unknown entity key", async () => {
    findById.mockResolvedValue({
      id: "a-1",
      ownerId: USER_ID,
      fundraisingEntity: "tbh",
    });
    await expect(
      service.update("a-1", USER_ID, [PERMISSIONS.INVESTORS_READ_ALL], {
        fundraisingEntity: "nope",
      }),
    ).rejects.toThrow(BadRequestException);
    expect(update).not.toHaveBeenCalled();
  });
});
