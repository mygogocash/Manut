import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@/common/exceptions/http-exception";
import { InvestorTagService } from "@/modules/investor-tags/investor-tags.service";

// Service talks to prisma directly (same shape as business-units), so the
// prisma client is the seam. `vi.mock` is hoisted above these imports.
const db = vi.hoisted(() => ({
  investorTag: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  investor: { count: vi.fn() },
  $transaction: vi.fn(),
  $executeRawUnsafe: vi.fn(),
}));

vi.mock("@/infrastructure/database/prisma", () => ({ prisma: db }));

let service: InvestorTagService;

beforeEach(() => {
  vi.clearAllMocks();
  service = new InvestorTagService();
  // Default: run the callback form against the same mock client.
  db.$transaction.mockImplementation(async (arg: unknown) =>
    typeof arg === "function"
      ? await (arg as (tx: typeof db) => Promise<unknown>)(db)
      : await Promise.all(arg as Promise<unknown>[]),
  );
});

describe("list", () => {
  it("hides inactive tags by default", async () => {
    db.investorTag.findMany.mockResolvedValue([]);
    await service.list({ includeInactive: false });
    expect(db.investorTag.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true } }),
    );
  });

  it("includes inactive tags when asked", async () => {
    db.investorTag.findMany.mockResolvedValue([]);
    await service.list({ includeInactive: true });
    expect(db.investorTag.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
  });
});

describe("create", () => {
  it("rejects a duplicate code", async () => {
    db.investorTag.findUnique.mockResolvedValue({ id: "t1" });
    await expect(
      service.create({ code: "seed-checks", label: "Seed checks" }),
    ).rejects.toThrow(ConflictException);
    expect(db.investorTag.create).not.toHaveBeenCalled();
  });

  it("appends after the current last row", async () => {
    db.investorTag.findUnique.mockResolvedValue(null);
    db.investorTag.findFirst.mockResolvedValue({ sortOrder: 40 });
    db.investorTag.create.mockResolvedValue({ id: "t2" });

    await service.create({ code: "warm-intro", label: "Warm intro" });

    expect(db.investorTag.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ sortOrder: 50, isSystem: false }),
      }),
    );
  });

  it("starts at 10 when the catalog is empty", async () => {
    db.investorTag.findUnique.mockResolvedValue(null);
    db.investorTag.findFirst.mockResolvedValue(null);
    db.investorTag.create.mockResolvedValue({ id: "t1" });

    await service.create({ code: "first", label: "First" });

    expect(db.investorTag.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ sortOrder: 10 }),
      }),
    );
  });
});

describe("update", () => {
  it("refuses to relabel a system tag", async () => {
    // A system row can be recoloured, re-sorted and deactivated, but not
    // renamed out from under investors already carrying it.
    db.investorTag.findUnique.mockResolvedValue({ id: "t1", isSystem: true });
    await expect(service.update("t1", { label: "Renamed" })).rejects.toThrow(
      ForbiddenException,
    );
    expect(db.investorTag.update).not.toHaveBeenCalled();
  });

  it("still allows recolouring a system tag", async () => {
    db.investorTag.findUnique.mockResolvedValue({ id: "t1", isSystem: true });
    db.investorTag.update.mockResolvedValue({ id: "t1" });
    await service.update("t1", { color: "teal" });
    expect(db.investorTag.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { color: "teal" } }),
    );
  });

  it("404s on a missing tag", async () => {
    db.investorTag.findUnique.mockResolvedValue(null);
    await expect(service.update("nope", { color: "red" })).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe("delete", () => {
  it("strips the code from investors before removing the tag", async () => {
    db.investorTag.findUnique.mockResolvedValue({
      id: "t1",
      code: "seed-checks",
      isSystem: false,
    });
    db.$executeRawUnsafe.mockResolvedValue(7);

    const result = await service.delete("t1");

    // The code must be a BOUND parameter, never interpolated — the table
    // name is the only literal in that statement.
    expect(db.$executeRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining("array_remove"),
      "seed-checks",
    );
    const [sql] = db.$executeRawUnsafe.mock.calls[0] as [string];
    expect(sql).toContain('"investors"');
    expect(sql).not.toContain("seed-checks");

    expect(db.investorTag.delete).toHaveBeenCalledWith({ where: { id: "t1" } });
    expect(result).toEqual({ success: true, investorsUntagged: 7 });
  });

  it("refuses to delete a system tag", async () => {
    db.investorTag.findUnique.mockResolvedValue({
      id: "t1",
      code: "seed-checks",
      isSystem: true,
    });
    await expect(service.delete("t1")).rejects.toThrow(ForbiddenException);
    expect(db.$executeRawUnsafe).not.toHaveBeenCalled();
    expect(db.investorTag.delete).not.toHaveBeenCalled();
  });

  it("404s on a missing tag without touching investors", async () => {
    db.investorTag.findUnique.mockResolvedValue(null);
    await expect(service.delete("nope")).rejects.toThrow(NotFoundException);
    expect(db.$executeRawUnsafe).not.toHaveBeenCalled();
  });
});

describe("reorder", () => {
  it("writes sortOrder = index", async () => {
    db.investorTag.findMany.mockResolvedValue([{ id: "a" }, { id: "b" }]);
    db.investorTag.update.mockResolvedValue({});

    const result = await service.reorder({ orderedIds: ["a", "b"] });

    expect(db.investorTag.update).toHaveBeenCalledWith({
      where: { id: "a" },
      data: { sortOrder: 0 },
    });
    expect(db.investorTag.update).toHaveBeenCalledWith({
      where: { id: "b" },
      data: { sortOrder: 1 },
    });
    expect(result).toEqual({ success: true, reordered: 2 });
  });

  it("refuses a payload naming a tag that does not exist", async () => {
    // Partial application would leave the list in an order the admin never
    // asked for, so this fails whole rather than reordering what it found.
    db.investorTag.findMany.mockResolvedValue([{ id: "a" }]);
    await expect(
      service.reorder({ orderedIds: ["a", "ghost"] }),
    ).rejects.toThrow(NotFoundException);
    expect(db.investorTag.update).not.toHaveBeenCalled();
  });
});

describe("usageCount", () => {
  it("counts investors carrying the code", async () => {
    db.investor.count.mockResolvedValue(43);
    await expect(service.usageCount("seed-checks")).resolves.toBe(43);
    expect(db.investor.count).toHaveBeenCalledWith({
      where: { tags: { has: "seed-checks" } },
    });
  });
});
