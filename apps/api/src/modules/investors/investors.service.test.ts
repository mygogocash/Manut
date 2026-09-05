import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { PERMISSIONS } from "@/common/constants/permissions";
import {
  BadRequestException,
  ForbiddenException,
} from "@/common/exceptions/http-exception";
import { resolveFundraisingEntityKey } from "@/modules/fundraising-entities/fundraising-entities.service";
import { investorsRepository } from "@/modules/investors/investors.repository";
import { investorsService } from "@/modules/investors/investors.service";

vi.mock("@/modules/investors/investors.repository", () => ({
  // Echo the filter so tests can assert the resolved where.
  buildInvestorWhere: vi.fn((f) => ({ ...f })),
  investorsRepository: {
    pipelineTotals: vi.fn(),
    bulkUpdate: vi.fn(),
    bulkDelete: vi.fn(),
    countInvestors: vi.fn(),
    addTagCodes: vi.fn(),
    findById: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/modules/fundraising-entities/fundraising-entities.service", () => ({
  resolveFundraisingEntityKey: vi.fn(),
}));

const pipelineTotals = investorsRepository.pipelineTotals as Mock;
const bulkUpdate = investorsRepository.bulkUpdate as Mock;
const bulkDelete = investorsRepository.bulkDelete as Mock;
const countInvestors = investorsRepository.countInvestors as Mock;
const addTagCodes = investorsRepository.addTagCodes as Mock;
const findById = investorsRepository.findById as Mock;
const update = investorsRepository.update as Mock;
const resolveEntity = resolveFundraisingEntityKey as Mock;
const USER_ID = "u-1";

// Stand-in for the real catalog lookup: known vehicles resolve, anything
// else 400s the same way `resolveFundraisingEntityKey` does.
const KNOWN_ENTITIES = ["tbh", "tbl"];

beforeEach(() => {
  vi.resetAllMocks();
  pipelineTotals.mockResolvedValue({});
  bulkUpdate.mockResolvedValue({ count: 3 });
  bulkDelete.mockResolvedValue({ count: 3 });
  findById.mockResolvedValue({ id: "a", addedBy: USER_ID });
  update.mockImplementation((id: string, data: Record<string, unknown>) => ({
    id,
    ...data,
  }));
  resolveEntity.mockImplementation((key: string) => {
    if (!KNOWN_ENTITIES.includes(key)) {
      throw new BadRequestException("Unknown fundraising entity");
    }
    return Promise.resolve(key);
  });
});

describe("investorsService.pipelineTotals — scoping mirrors list", () => {
  it("scopes to the caller without investors:read-all", async () => {
    await investorsService.pipelineTotals(USER_ID, [
      PERMISSIONS.INVESTORS_READ,
    ]);
    expect(pipelineTotals).toHaveBeenCalledWith({ addedBy: USER_ID });
  });

  it("sees all stages with investors:read-all", async () => {
    await investorsService.pipelineTotals(USER_ID, [
      PERMISSIONS.INVESTORS_READ_ALL,
    ]);
    expect(pipelineTotals).toHaveBeenCalledWith({ addedBy: undefined });
  });

  it("forwards the fundraising entity to the repository", async () => {
    await investorsService.pipelineTotals(
      USER_ID,
      [PERMISSIONS.INVESTORS_READ_ALL],
      { fundraisingEntity: "tbl" },
    );
    expect(pipelineTotals).toHaveBeenCalledWith({
      fundraisingEntity: "tbl",
      addedBy: undefined,
    });
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

  it("moves the selection to a resolved fundraising entity", async () => {
    await investorsService.bulkUpdate(
      USER_ID,
      [PERMISSIONS.INVESTORS_UPDATE, PERMISSIONS.INVESTORS_READ_ALL],
      { ids: ["a"], set: { fundraisingEntity: "tbl" } },
    );
    expect(resolveEntity).toHaveBeenCalledWith("tbl");
    expect(bulkUpdate).toHaveBeenCalledWith(
      { id: { in: ["a"] } },
      { fundraisingEntity: "tbl" },
    );
  });

  it("rejects an unknown entity before touching any row", async () => {
    await expect(
      investorsService.bulkUpdate(
        USER_ID,
        [PERMISSIONS.INVESTORS_UPDATE, PERMISSIONS.INVESTORS_READ_ALL],
        { ids: ["a"], set: { fundraisingEntity: "nope" } },
      ),
    ).rejects.toThrow(BadRequestException);
    expect(bulkUpdate).not.toHaveBeenCalled();
  });

  it("returns the updated count", async () => {
    const res = await investorsService.bulkUpdate(
      USER_ID,
      [PERMISSIONS.INVESTORS_UPDATE, PERMISSIONS.INVESTORS_READ_ALL],
      { ids: ["a", "b", "c"], set: { status: "dd" } },
    );
    // A non-archive field writes every matched row, so nothing is skipped and
    // no extra count is issued — `selected` mirrors `updated`.
    expect(res).toEqual({ updated: 3, selected: 3, skipped: 0, failed: [] });
    expect(countInvestors).not.toHaveBeenCalled();
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

describe("investorsService.update — fundraising entity", () => {
  it("writes a resolved entity key", async () => {
    await investorsService.update("a", { fundraisingEntity: "tbl" }, USER_ID, [
      PERMISSIONS.INVESTORS_UPDATE,
    ]);
    expect(resolveEntity).toHaveBeenCalledWith("tbl");
    expect(update).toHaveBeenCalledWith(
      "a",
      expect.objectContaining({ fundraisingEntity: "tbl" }),
    );
  });

  it("rejects an unknown entity key", async () => {
    await expect(
      investorsService.update("a", { fundraisingEntity: "nope" }, USER_ID, [
        PERMISSIONS.INVESTORS_UPDATE,
      ]),
    ).rejects.toThrow(BadRequestException);
    expect(update).not.toHaveBeenCalled();
  });

  it("leaves the entity untouched when the field is absent", async () => {
    await investorsService.update("a", { name: "Renamed" }, USER_ID, [
      PERMISSIONS.INVESTORS_UPDATE,
    ]);
    expect(resolveEntity).not.toHaveBeenCalled();
    const [, data] = update.mock.calls[0] as [string, Record<string, unknown>];
    expect(data).not.toHaveProperty("fundraisingEntity");
  });
});

describe("investorsService.bulkUpdate — archive", () => {
  it("only touches rows not already archived, so archivedAt is never reset", async () => {
    // The single-row path is idempotent via `existing.archivedAt ?? new Date()`.
    // updateMany cannot express that per row, so the WHERE has to carry it —
    // without this, re-archiving a selection rewrites real archive dates.
    countInvestors.mockResolvedValue(5);
    bulkUpdate.mockResolvedValue({ count: 3 });

    const res = await investorsService.bulkUpdate(
      USER_ID,
      [PERMISSIONS.INVESTORS_UPDATE, PERMISSIONS.INVESTORS_READ_ALL],
      { ids: ["a", "b", "c", "d", "e"], set: { archived: true } },
    );

    const [where, data] = bulkUpdate.mock.calls[0] as [
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    expect(where.archivedAt).toBeNull();
    expect(data.archivedAt).toBeInstanceOf(Date);
    // 2 of the 5 were already archived and were left alone.
    expect(res).toMatchObject({ updated: 3, selected: 5, skipped: 2 });
  });

  it("restores only rows that are actually archived", async () => {
    countInvestors.mockResolvedValue(2);
    bulkUpdate.mockResolvedValue({ count: 2 });

    await investorsService.bulkUpdate(
      USER_ID,
      [PERMISSIONS.INVESTORS_UPDATE, PERMISSIONS.INVESTORS_READ_ALL],
      { ids: ["a", "b"], set: { archived: false } },
    );

    const [where, data] = bulkUpdate.mock.calls[0] as [
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    expect(where.archivedAt).toEqual({ not: null });
    expect(data.archivedAt).toBeNull();
  });
});

describe("investorsService.bulkSetTags", () => {
  it("add appends one guarded statement per code, never a wholesale rewrite", async () => {
    // Guarded per-code pushes preserve each row's existing tag order. A
    // computed-union rewrite would have to pick an order and would churn rows
    // that gained nothing.
    countInvestors.mockResolvedValueOnce(4).mockResolvedValueOnce(3);
    addTagCodes.mockResolvedValue([{ count: 3 }, { count: 3 }]);

    const res = await investorsService.bulkSetTags(
      USER_ID,
      [PERMISSIONS.INVESTORS_UPDATE, PERMISSIONS.INVESTORS_READ_ALL],
      { ids: ["a", "b", "c", "d"], mode: "add", codes: ["seed-checks", "vc"] },
    );

    // ONE call carrying both codes — they are applied in a single
    // transaction, so a mid-batch failure cannot leave one code applied.
    expect(addTagCodes).toHaveBeenCalledTimes(1);
    expect(addTagCodes.mock.calls[0]?.[1]).toEqual(["seed-checks", "vc"]);
    expect(bulkUpdate).not.toHaveBeenCalled();
    expect(res).toMatchObject({ selected: 4, updated: 3, skipped: 1 });
  });

  it("de-duplicates requested codes", async () => {
    countInvestors.mockResolvedValue(1);
    addTagCodes.mockResolvedValue([{ count: 1 }]);

    await investorsService.bulkSetTags(
      USER_ID,
      [PERMISSIONS.INVESTORS_UPDATE, PERMISSIONS.INVESTORS_READ_ALL],
      { ids: ["a"], mode: "add", codes: ["vc", "vc", "vc"] },
    );

    expect(addTagCodes.mock.calls[0]?.[1]).toEqual(["vc"]);
  });

  it("replace overwrites every matched row, including clearing to empty", async () => {
    countInvestors.mockResolvedValue(2);
    bulkUpdate.mockResolvedValue({ count: 2 });

    const res = await investorsService.bulkSetTags(
      USER_ID,
      [PERMISSIONS.INVESTORS_UPDATE, PERMISSIONS.INVESTORS_READ_ALL],
      { ids: ["a", "b"], mode: "replace", codes: [] },
    );

    const [, data] = bulkUpdate.mock.calls[0] as [
      unknown,
      Record<string, unknown>,
    ];
    expect(data).toEqual({ tags: [] });
    expect(addTagCodes).not.toHaveBeenCalled();
    expect(res).toMatchObject({ updated: 2, skipped: 0 });
  });

  it("owner-scopes the selection for a caller without investors:read-all", async () => {
    countInvestors.mockResolvedValue(0);

    await investorsService.bulkSetTags(
      USER_ID,
      [PERMISSIONS.INVESTORS_UPDATE],
      { ids: ["someone-elses"], mode: "add", codes: ["vc"] },
    );

    const [where] = countInvestors.mock.calls[0] as [Record<string, unknown>];
    expect(where).toMatchObject({ addedBy: USER_ID });
  });

  it("carries the board's statusIn facet through an allMatching selection", async () => {
    // Without statusIn, "select all N" from the kanban resolves wider than the
    // board counted — legacy statuses have no column but do match.
    countInvestors.mockResolvedValue(0);

    await investorsService.bulkSetTags(
      USER_ID,
      [PERMISSIONS.INVESTORS_UPDATE, PERMISSIONS.INVESTORS_READ_ALL],
      {
        allMatching: true,
        filter: { statusIn: ["lead", "dd"], archived: false },
        mode: "add",
        codes: ["vc"],
      },
    );

    const [where] = countInvestors.mock.calls[0] as [Record<string, unknown>];
    expect(where).toMatchObject({ statusIn: ["lead", "dd"], archived: false });
  });
});
