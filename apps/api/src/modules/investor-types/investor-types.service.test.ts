import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import {
  BadRequestException,
  NotFoundException,
} from "@/common/exceptions/http-exception";
import { investorTypeRepository } from "@/modules/investor-types/investor-types.repository";
import {
  DEFAULT_INVESTOR_TYPES,
  InvestorTypeService,
} from "@/modules/investor-types/investor-types.service";

vi.mock("@/modules/investor-types/investor-types.repository", () => ({
  investorTypeRepository: {
    findAll: vi.fn(),
    findByKey: vi.fn(),
    maxSortOrder: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    deleteAndReassign: vi.fn(),
    applySortOrder: vi.fn(),
    createManyIfMissing: vi.fn(),
  },
}));

const findAll = investorTypeRepository.findAll as Mock;
const createManyIfMissing = investorTypeRepository.createManyIfMissing as Mock;
const findByKey = investorTypeRepository.findByKey as Mock;
const maxSortOrder = investorTypeRepository.maxSortOrder as Mock;
const create = investorTypeRepository.create as Mock;
const deleteAndReassign = investorTypeRepository.deleteAndReassign as Mock;
const service = new InvestorTypeService();

beforeEach(() => {
  vi.resetAllMocks();
});

describe("InvestorTypeService.create", () => {
  it("slugifies the label into a key and appends after the last type", async () => {
    findByKey.mockResolvedValue(null);
    maxSortOrder.mockResolvedValue(4);
    create.mockResolvedValue({ key: "hedge_fund" });
    await service.create({ label: "Hedge Fund" });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ key: "hedge_fund", sortOrder: 5 }),
    );
  });

  it("suffixes the key on collision", async () => {
    findByKey
      .mockResolvedValueOnce({ key: "family_office" })
      .mockResolvedValueOnce(null);
    maxSortOrder.mockResolvedValue(0);
    create.mockResolvedValue({ key: "family_office_1" });
    await service.create({ label: "Family Office" });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ key: "family_office_1" }),
    );
  });
});

describe("InvestorTypeService.delete", () => {
  it("reassigns investors to 'other' when present", async () => {
    findAll.mockResolvedValue([
      { key: "family_office" },
      { key: "venture_capital" },
      { key: "other" },
    ]);
    deleteAndReassign.mockResolvedValue(undefined);
    const res = await service.delete("venture_capital");
    expect(deleteAndReassign).toHaveBeenCalledWith("venture_capital", "other");
    expect(res.reassignedTo).toBe("other");
  });

  it("falls back to the first remaining type when 'other' is the one deleted", async () => {
    findAll.mockResolvedValue([{ key: "family_office" }, { key: "other" }]);
    deleteAndReassign.mockResolvedValue(undefined);
    const res = await service.delete("other");
    expect(res.reassignedTo).toBe("family_office");
  });

  it("refuses to delete the last type", async () => {
    findAll.mockResolvedValue([{ key: "only" }]);
    await expect(service.delete("only")).rejects.toThrow(BadRequestException);
  });

  it("404s on an unknown type", async () => {
    findAll.mockResolvedValue([{ key: "a" }, { key: "b" }]);
    await expect(service.delete("ghost")).rejects.toThrow(NotFoundException);
  });
});

describe("investor type catalog lazy seeding", () => {
  // The rows ship as an INSERT inside a migration, which `db:push` never runs —
  // staging had an empty table, so the board rendered zero columns / the picker
  // had no options and the module looked broken.
  it("backfills the shipped catalog when the table is empty", async () => {
    const seeded = DEFAULT_INVESTOR_TYPES.map((r) => ({ ...r }));
    findAll.mockResolvedValueOnce([]).mockResolvedValueOnce(seeded);
    createManyIfMissing.mockResolvedValue({ count: seeded.length });

    const res = await new InvestorTypeService().list();

    expect(createManyIfMissing).toHaveBeenCalledTimes(1);
    expect(createManyIfMissing.mock.calls[0][0]).toHaveLength(12);
    expect(createManyIfMissing.mock.calls[0][0][0]).toMatchObject({
      key: "family_office",
    });
    expect(res).toHaveLength(12);
  });

  it("never repopulates a catalog an admin deliberately pruned", async () => {
    findAll.mockResolvedValue([
      { key: "family_office", label: "Kept", sortOrder: 0 },
    ]);

    const res = await new InvestorTypeService().list();

    expect(createManyIfMissing).not.toHaveBeenCalled();
    expect(res).toHaveLength(1);
  });

  it("degrades to an empty catalog when the repository yields nothing", async () => {
    findAll.mockResolvedValue(undefined);
    createManyIfMissing.mockResolvedValue({ count: 0 });

    await expect(new InvestorTypeService().list()).resolves.toEqual([]);
  });
});
