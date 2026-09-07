import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import {
  BadRequestException,
  NotFoundException,
} from "@/common/exceptions/http-exception";
import { fundraisingEntityRepository } from "@/modules/fundraising-entities/fundraising-entities.repository";
import {
  FundraisingEntityService,
  resolveFundraisingEntityKey,
} from "@/modules/fundraising-entities/fundraising-entities.service";

vi.mock(
  "@/modules/fundraising-entities/fundraising-entities.repository",
  () => ({
    fundraisingEntityRepository: {
      findAll: vi.fn(),
      findByKey: vi.fn(),
      maxSortOrder: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deleteAndReassign: vi.fn(),
      applySortOrder: vi.fn(),
      createManyIfMissing: vi.fn(),
    },
  }),
);

const findAll = fundraisingEntityRepository.findAll as Mock;
const createManyIfMissing =
  fundraisingEntityRepository.createManyIfMissing as Mock;
const findByKey = fundraisingEntityRepository.findByKey as Mock;
const maxSortOrder = fundraisingEntityRepository.maxSortOrder as Mock;
const create = fundraisingEntityRepository.create as Mock;
const deleteAndReassign = fundraisingEntityRepository.deleteAndReassign as Mock;
const service = new FundraisingEntityService();

beforeEach(() => {
  vi.resetAllMocks();
});

describe("resolveFundraisingEntityKey", () => {
  it("defaults to tbh when omitted", async () => {
    findByKey.mockResolvedValue({ key: "tbh" });
    await expect(resolveFundraisingEntityKey(undefined)).resolves.toBe("tbh");
    expect(findByKey).toHaveBeenCalledWith("tbh");
  });

  it("rejects an unknown key", async () => {
    findByKey.mockResolvedValue(null);
    await expect(resolveFundraisingEntityKey("ghost")).rejects.toThrow(
      BadRequestException,
    );
  });
});

describe("FundraisingEntityService.create", () => {
  it("slugifies the label into a key and appends after the last entity", async () => {
    findByKey.mockResolvedValue(null);
    maxSortOrder.mockResolvedValue(1);
    create.mockResolvedValue({ key: "the_binary_labs" });
    await service.create({ label: "The Binary Labs" });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ key: "the_binary_labs", sortOrder: 2 }),
    );
  });

  it("suffixes the key on collision", async () => {
    findByKey.mockResolvedValueOnce({ key: "tbh" }).mockResolvedValueOnce(null);
    maxSortOrder.mockResolvedValue(0);
    create.mockResolvedValue({ key: "tbh_1" });
    await service.create({ label: "TBH" });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ key: "tbh_1" }),
    );
  });
});

describe("FundraisingEntityService.delete", () => {
  it("reassigns rows to tbh when present", async () => {
    findAll.mockResolvedValue([{ key: "tbh" }, { key: "tbl" }]);
    deleteAndReassign.mockResolvedValue(undefined);
    const res = await service.delete("tbl");
    expect(deleteAndReassign).toHaveBeenCalledWith("tbl", "tbh");
    expect(res.reassignedTo).toBe("tbh");
  });

  it("falls back to the first remaining entity when tbh is deleted", async () => {
    findAll.mockResolvedValue([{ key: "tbh" }, { key: "tbl" }]);
    deleteAndReassign.mockResolvedValue(undefined);
    const res = await service.delete("tbh");
    expect(res.reassignedTo).toBe("tbl");
  });

  it("refuses to delete the last entity", async () => {
    findAll.mockResolvedValue([{ key: "tbh" }]);
    await expect(service.delete("tbh")).rejects.toThrow(BadRequestException);
  });

  it("404s on an unknown entity", async () => {
    findAll.mockResolvedValue([{ key: "tbh" }, { key: "tbl" }]);
    await expect(service.delete("ghost")).rejects.toThrow(NotFoundException);
  });
});

describe("fundraising entity catalog lazy seeding", () => {
  // Staging syncs with db:push, which creates the table but never runs the
  // migration INSERT — the catalog was empty there and the switcher hid itself.
  it("backfills the shipped catalog when the table is empty", async () => {
    const seeded = [
      { key: "tbh", label: "Manut", sortOrder: 0 },
      { key: "tbl", label: "The Binary Labs", sortOrder: 1 },
    ];
    findAll.mockResolvedValueOnce([]).mockResolvedValueOnce(seeded);
    createManyIfMissing.mockResolvedValue({ count: 2 });

    const res = await new FundraisingEntityService().list();

    expect(createManyIfMissing).toHaveBeenCalledWith([
      { key: "tbh", label: "Manut", sortOrder: 0 },
      { key: "tbl", label: "The Binary Labs", sortOrder: 1 },
    ]);
    expect(res).toEqual(seeded);
  });

  it("never repopulates a catalog an admin deliberately pruned", async () => {
    // One row left is NOT an empty catalog, so a deleted vehicle stays deleted.
    findAll.mockResolvedValue([
      { key: "tbl", label: "The Binary Labs", sortOrder: 0 },
    ]);

    const res = await new FundraisingEntityService().list();

    expect(createManyIfMissing).not.toHaveBeenCalled();
    expect(res).toHaveLength(1);
  });

  it("resolves a default key on a fresh database instead of 400ing", async () => {
    findByKey.mockResolvedValue(null);
    findAll.mockResolvedValueOnce([]).mockResolvedValueOnce([
      { key: "tbh", label: "Manut", sortOrder: 0 },
      { key: "tbl", label: "The Binary Labs", sortOrder: 1 },
    ]);
    createManyIfMissing.mockResolvedValue({ count: 2 });

    await expect(resolveFundraisingEntityKey("tbh")).resolves.toBe("tbh");
  });

  it("still rejects a genuinely unknown key after seeding", async () => {
    findByKey.mockResolvedValue(null);
    findAll
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { key: "tbh", label: "Manut", sortOrder: 0 },
      ]);
    createManyIfMissing.mockResolvedValue({ count: 1 });

    await expect(resolveFundraisingEntityKey("nope")).rejects.toThrow(
      BadRequestException,
    );
  });
});
