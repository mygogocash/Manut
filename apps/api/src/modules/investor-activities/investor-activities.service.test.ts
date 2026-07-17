import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { PERMISSIONS } from "@/common/constants/permissions";
import { NotFoundException } from "@/common/exceptions/http-exception";
import { investorActivityRepository } from "@/modules/investor-activities/investor-activities.repository";
import { InvestorActivityService } from "@/modules/investor-activities/investor-activities.service";
import { investorsRepository } from "@/modules/investors/investors.repository";
import { mockArgument } from "@/test-utils/assertions";

vi.mock("@/modules/investor-activities/investor-activities.repository", () => ({
  investorActivityRepository: {
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

const findMany = investorActivityRepository.findMany as Mock;
const findById = investorActivityRepository.findById as Mock;
const create = investorActivityRepository.create as Mock;
const update = investorActivityRepository.update as Mock;
const investorFindById = investorsRepository.findById as Mock;

const USER_ID = "u-1";
const service = new InvestorActivityService();

beforeEach(() => {
  vi.resetAllMocks();
  findMany.mockResolvedValue({ data: [], total: 0 });
  investorFindById.mockResolvedValue({ id: "inv-1", addedBy: USER_ID });
});

describe("InvestorActivityService.list — ownership scoping", () => {
  it("scopes to the caller without investors:read-all", async () => {
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

  it("does not scope with investors:read-all", async () => {
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
});

describe("InvestorActivityService.create", () => {
  it("connects the owner + investor and parses occurredAt", async () => {
    create.mockResolvedValue({ id: "a-1" });
    await service.create(USER_ID, [PERMISSIONS.INVESTORS_READ_ALL], {
      type: "call",
      subject: "Intro call",
      occurredAt: "2026-05-20T10:00:00.000Z",
      investorId: "inv-1",
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "call",
        subject: "Intro call",
        occurredAt: expect.any(Date),
        owner: { connect: { id: USER_ID } },
        investor: { connect: { id: "inv-1" } },
      }),
    );
  });

  it("rejects logging against an investor the caller cannot access (IDOR)", async () => {
    investorFindById.mockResolvedValue({
      id: "inv-1",
      addedBy: "someone-else",
    });
    await expect(
      service.create(USER_ID, [PERMISSIONS.INVESTORS_READ], {
        type: "call",
        subject: "x",
        occurredAt: "2026-05-20T10:00:00.000Z",
        investorId: "inv-1",
      }),
    ).rejects.toThrow(NotFoundException);
    expect(create).not.toHaveBeenCalled();
  });
});

describe("InvestorActivityService.update — parent immutable + scoping", () => {
  it("never re-anchors the investor (only own fields update)", async () => {
    findById.mockResolvedValue({ id: "a-1", ownerId: USER_ID });
    update.mockResolvedValue({ id: "a-1" });
    await service.update("a-1", USER_ID, [PERMISSIONS.INVESTORS_READ_ALL], {
      subject: "Renamed",
    });
    const data = mockArgument(update.mock.calls, 0, 1);
    expect(data).not.toHaveProperty("investor");
    expect(data).not.toHaveProperty("investorId");
    expect(data).toMatchObject({ subject: "Renamed" });
  });

  it("hides another owner's activity from a non-read-all caller", async () => {
    findById.mockResolvedValue({ id: "a-1", ownerId: "someone-else" });
    await expect(
      service.getById("a-1", USER_ID, [PERMISSIONS.INVESTORS_READ]),
    ).rejects.toThrow(NotFoundException);
  });
});
