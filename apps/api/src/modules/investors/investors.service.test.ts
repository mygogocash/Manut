import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { PERMISSIONS } from "@/common/constants/permissions";
import { ForbiddenException } from "@/common/exceptions/http-exception";
import { investorsRepository } from "@/modules/investors/investors.repository";
import { investorsService } from "@/modules/investors/investors.service";

vi.mock("@/modules/investors/investors.repository", () => ({
  // Echo the filter so tests can assert the resolved where.
  buildInvestorWhere: vi.fn((f) => ({ ...f })),
  investorsRepository: {
    pipelineTotals: vi.fn(),
    bulkUpdate: vi.fn(),
    bulkDelete: vi.fn(),
  },
}));

const pipelineTotals = investorsRepository.pipelineTotals as Mock;
const bulkUpdate = investorsRepository.bulkUpdate as Mock;
const bulkDelete = investorsRepository.bulkDelete as Mock;
const USER_ID = "u-1";

beforeEach(() => {
  vi.resetAllMocks();
  pipelineTotals.mockResolvedValue({});
  bulkUpdate.mockResolvedValue({ count: 3 });
  bulkDelete.mockResolvedValue({ count: 3 });
});

describe("investorsService.pipelineTotals — scoping mirrors list", () => {
  it("scopes to the caller without investors:read-all", async () => {
    await investorsService.pipelineTotals(USER_ID, [
      PERMISSIONS.INVESTORS_READ,
    ]);
    expect(pipelineTotals).toHaveBeenCalledWith(USER_ID);
  });

  it("sees all stages with investors:read-all", async () => {
    await investorsService.pipelineTotals(USER_ID, [
      PERMISSIONS.INVESTORS_READ_ALL,
    ]);
    expect(pipelineTotals).toHaveBeenCalledWith(undefined);
  });
});

describe("investorsService.bulkUpdate", () => {
  it("scopes explicit ids to the caller's own rows (non read-all)", async () => {
    await investorsService.bulkUpdate(USER_ID, [PERMISSIONS.INVESTORS_UPDATE], {
      ids: ["a", "b"],
      set: { status: "dd" },
    });
    expect(bulkUpdate).toHaveBeenCalledWith(
      { id: { in: ["a", "b"] }, addedBy: USER_ID },
      { status: "dd" },
    );
  });

  it("does not owner-scope when read-all", async () => {
    await investorsService.bulkUpdate(
      USER_ID,
      [PERMISSIONS.INVESTORS_UPDATE, PERMISSIONS.INVESTORS_READ_ALL],
      { ids: ["a"], set: { status: "dd" } },
    );
    expect(bulkUpdate).toHaveBeenCalledWith(
      { id: { in: ["a"] } },
      { status: "dd" },
    );
  });

  it("resolves allMatching through the shared filter where", async () => {
    await investorsService.bulkUpdate(
      USER_ID,
      [PERMISSIONS.INVESTORS_UPDATE, PERMISSIONS.INVESTORS_READ_ALL],
      { allMatching: true, filter: { status: "lead" }, set: { type: "vc" } },
    );
    expect(bulkUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: "lead" }),
      { type: "vc" },
    );
  });

  it("rejects owner reassignment without read-all", async () => {
    await expect(
      investorsService.bulkUpdate(USER_ID, [PERMISSIONS.INVESTORS_UPDATE], {
        ids: ["a"],
        set: { addedBy: "00000000-0000-0000-0000-000000000000" },
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(bulkUpdate).not.toHaveBeenCalled();
  });

  it("returns the updated count", async () => {
    const res = await investorsService.bulkUpdate(
      USER_ID,
      [PERMISSIONS.INVESTORS_UPDATE, PERMISSIONS.INVESTORS_READ_ALL],
      { ids: ["a", "b", "c"], set: { status: "dd" } },
    );
    expect(res).toEqual({ updated: 3 });
  });
});

describe("investorsService.bulkDelete", () => {
  it("owner-scopes the delete for non read-all callers", async () => {
    await investorsService.bulkDelete(USER_ID, [PERMISSIONS.INVESTORS_DELETE], {
      ids: ["a", "b"],
    });
    expect(bulkDelete).toHaveBeenCalledWith({
      id: { in: ["a", "b"] },
      addedBy: USER_ID,
    });
  });
});
