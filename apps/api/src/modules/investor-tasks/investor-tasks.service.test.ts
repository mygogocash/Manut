import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { PERMISSIONS } from "@/common/constants/permissions";
import {
  BadRequestException,
  NotFoundException,
} from "@/common/exceptions/http-exception";
import { investorTaskRepository } from "@/modules/investor-tasks/investor-tasks.repository";
import { InvestorTaskService } from "@/modules/investor-tasks/investor-tasks.service";
import { investorsRepository } from "@/modules/investors/investors.repository";
import { mockArgument } from "@/test-utils/assertions";

vi.mock("@/modules/investor-tasks/investor-tasks.repository", () => ({
  investorTaskRepository: {
    findMany: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("@/modules/investors/investors.repository", () => ({
  investorsRepository: { findById: vi.fn() },
}));

const findMany = investorTaskRepository.findMany as Mock;
const findById = investorTaskRepository.findById as Mock;
const update = investorTaskRepository.update as Mock;
const create = investorTaskRepository.create as Mock;
const investorFindById = investorsRepository.findById as Mock;

const USER_ID = "u-1";
const service = new InvestorTaskService();

beforeEach(() => {
  vi.resetAllMocks();
  findMany.mockResolvedValue({ data: [], total: 0 });
  investorFindById.mockResolvedValue({ id: "inv-1", addedBy: USER_ID });
});

describe("InvestorTaskService.list — ownership scoping", () => {
  it("scopes to the caller when they lack investors:read-all", async () => {
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

  it("does not scope when the caller holds investors:read-all", async () => {
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

  it("translates the 'today' bucket into a same-day window", async () => {
    await service.list(USER_ID, [PERMISSIONS.INVESTORS_READ_ALL], {
      page: 1,
      limit: 20,
      bucket: "today",
    });
    const args = mockArgument(findMany.mock.calls, 0, 0);
    expect(args.dueDateGte).toBeInstanceOf(Date);
    expect(args.dueDateLte).toBeInstanceOf(Date);
    expect(args.dueDateGte.getTime()).toBe(args.dueDateLte.getTime());
  });
});

describe("InvestorTaskService.complete", () => {
  it("stamps completedAt and flips status to done", async () => {
    findById.mockResolvedValue({
      id: "t-1",
      ownerId: USER_ID,
      status: "open",
      completedAt: null,
    });
    update.mockResolvedValue({ id: "t-1", status: "done" });

    await service.complete("t-1", USER_ID, [PERMISSIONS.INVESTORS_READ_ALL]);

    expect(update).toHaveBeenCalledWith(
      "t-1",
      expect.objectContaining({
        status: "done",
        completedAt: expect.any(Date),
      }),
    );
  });

  it("is a no-op on an already-done task", async () => {
    findById.mockResolvedValue({
      id: "t-1",
      ownerId: USER_ID,
      status: "done",
      completedAt: new Date(),
    });
    const result = await service.complete("t-1", USER_ID, [
      PERMISSIONS.INVESTORS_READ_ALL,
    ]);
    expect(update).not.toHaveBeenCalled();
    expect(result.status).toBe("done");
  });

  it("rejects completing a cancelled task", async () => {
    findById.mockResolvedValue({
      id: "t-1",
      ownerId: USER_ID,
      status: "cancelled",
    });
    await expect(
      service.complete("t-1", USER_ID, [PERMISSIONS.INVESTORS_READ_ALL]),
    ).rejects.toThrow(BadRequestException);
  });
});

describe("InvestorTaskService.getById — scoping", () => {
  it("hides another owner's task from a non-read-all caller", async () => {
    findById.mockResolvedValue({ id: "t-1", ownerId: "someone-else" });
    await expect(
      service.getById("t-1", USER_ID, [PERMISSIONS.INVESTORS_READ]),
    ).rejects.toThrow(NotFoundException);
  });
});

describe("InvestorTaskService.create — investor access guard", () => {
  it("rejects a task against an investor the caller cannot access (IDOR)", async () => {
    investorFindById.mockResolvedValue({
      id: "inv-1",
      addedBy: "someone-else",
    });
    await expect(
      service.create(USER_ID, [PERMISSIONS.INVESTORS_READ], {
        subject: "x",
        dueDate: "2026-05-20",
        investorId: "inv-1",
      }),
    ).rejects.toThrow(NotFoundException);
    expect(create).not.toHaveBeenCalled();
  });
});
