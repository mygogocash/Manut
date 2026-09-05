import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@/common/exceptions/http-exception";
import {
  BUSINESS_UNIT_TABLES,
  BusinessUnitService,
} from "@/modules/business-units/business-units.service";
import * as revenueBusinessUnits from "@/modules/business-units/revenue-rollup.repository";
import * as salesBusinessUnits from "@/modules/opportunities/opportunity-business-units.repository";

// Service talks to prisma directly (same shape as lost-reasons), so the
// prisma client is the seam. `vi.mock` is hoisted above these imports.
const db = vi.hoisted(() => ({
  crmBusinessUnit: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  opportunity: { findMany: vi.fn() },
  revenueOpportunity: { findMany: vi.fn() },
  opportunityBusinessUnit: { deleteMany: vi.fn() },
  revenueOpportunityBusinessUnit: { deleteMany: vi.fn() },
  $transaction: vi.fn(),
  $executeRawUnsafe: vi.fn(),
}));

// Deleting a unit strips its code from the tag arrays, so the per-unit
// child rows have to go too and the affected deals have to be recomputed.
vi.mock(
  "@/modules/opportunities/opportunity-business-units.repository",
  () => ({ recomputeOpportunityRollup: vi.fn(async () => {}) }),
);
vi.mock("@/modules/business-units/revenue-rollup.repository", () => ({
  recomputeRevenueOpportunityRollup: vi.fn(async () => {}),
}));

vi.mock("@/infrastructure/database/prisma", () => ({ prisma: db }));

const salesRecompute = salesBusinessUnits.recomputeOpportunityRollup as Mock;
const revenueRecompute =
  revenueBusinessUnits.recomputeRevenueOpportunityRollup as Mock;

let service: BusinessUnitService;

beforeEach(() => {
  vi.clearAllMocks();
  service = new BusinessUnitService();
  db.crmBusinessUnit.findMany.mockResolvedValue([]);
  db.crmBusinessUnit.findFirst.mockResolvedValue(null);
  db.crmBusinessUnit.findUnique.mockResolvedValue(null);
  db.opportunity.findMany.mockResolvedValue([]);
  db.revenueOpportunity.findMany.mockResolvedValue([]);
  // Both transaction flavours: an array of promises (reorder) and an
  // interactive callback (delete).
  db.$transaction.mockImplementation(async (arg: unknown) =>
    typeof arg === "function"
      ? (arg as (tx: unknown) => Promise<unknown>)(db)
      : Promise.all(arg as Promise<unknown>[]),
  );
});

describe("list", () => {
  it("hides deactivated units by default", async () => {
    await service.list({ includeInactive: false });

    expect(db.crmBusinessUnit.findMany.mock.calls[0][0].where).toEqual({
      isActive: true,
    });
  });

  it("returns everything for the manager dialog", async () => {
    await service.list({ includeInactive: true });

    expect(db.crmBusinessUnit.findMany.mock.calls[0][0].where).toEqual({});
  });
});

describe("create", () => {
  it("rejects a duplicate code", async () => {
    db.crmBusinessUnit.findUnique.mockResolvedValue({ id: "bu-1" });

    await expect(
      service.create({ code: "onewave", label: "Onewave" }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(db.crmBusinessUnit.create).not.toHaveBeenCalled();
  });

  it("appends past the current last row and defaults the colour", async () => {
    db.crmBusinessUnit.findFirst.mockResolvedValue({ sortOrder: 30 });
    db.crmBusinessUnit.create.mockResolvedValue({ id: "bu-9" });

    await service.create({ code: "new-unit", label: "New Unit" });

    expect(db.crmBusinessUnit.create.mock.calls[0][0].data).toMatchObject({
      code: "new-unit",
      label: "New Unit",
      color: "grey",
      sortOrder: 40,
      isSystem: false,
      isActive: true,
    });
  });

  it("creates deletable (non-system) rows so admins can remove units", async () => {
    db.crmBusinessUnit.create.mockResolvedValue({ id: "bu-9" });

    await service.create({ code: "new-unit", label: "New Unit" });

    expect(db.crmBusinessUnit.create.mock.calls[0][0].data.isSystem).toBe(
      false,
    );
  });
});

describe("update", () => {
  it("404s on a missing row", async () => {
    await expect(service.update("nope", { label: "x" })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("refuses to relabel a system row but allows a recolour", async () => {
    db.crmBusinessUnit.findUnique.mockResolvedValue({
      id: "bu-1",
      isSystem: true,
    });

    await expect(
      service.update("bu-1", { label: "Renamed" }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    db.crmBusinessUnit.update.mockResolvedValue({ id: "bu-1" });
    await service.update("bu-1", { color: "teal" });
    expect(db.crmBusinessUnit.update.mock.calls[0][0].data).toEqual({
      color: "teal",
    });
  });
});

describe("reorder", () => {
  it("writes sortOrder = index for the supplied order", async () => {
    db.crmBusinessUnit.findMany.mockResolvedValue([
      { id: "a" },
      { id: "b" },
      { id: "c" },
    ]);
    db.crmBusinessUnit.update.mockResolvedValue({});

    const result = await service.reorder({ orderedIds: ["c", "a", "b"] });

    expect(
      db.crmBusinessUnit.update.mock.calls.map((c) => [
        c[0].where.id,
        c[0].data.sortOrder,
      ]),
    ).toEqual([
      ["c", 0],
      ["a", 1],
      ["b", 2],
    ]);
    expect(result).toEqual({ success: true, reordered: 3 });
  });

  it("404s when an id does not exist rather than silently skipping it", async () => {
    db.crmBusinessUnit.findMany.mockResolvedValue([{ id: "a" }]);

    await expect(
      service.reorder({ orderedIds: ["a", "ghost"] }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(db.crmBusinessUnit.update).not.toHaveBeenCalled();
  });
});

describe("delete", () => {
  it("strips the code from every tagged table, then deletes the row", async () => {
    db.crmBusinessUnit.findUnique.mockResolvedValue({
      id: "bu-1",
      code: "onewave",
      isSystem: false,
    });

    await service.delete("bu-1");

    // One array_remove per record table, code always bound as a parameter.
    expect(db.$executeRawUnsafe).toHaveBeenCalledTimes(
      BUSINESS_UNIT_TABLES.length,
    );
    for (const [idx, table] of BUSINESS_UNIT_TABLES.entries()) {
      const [sql, code] = db.$executeRawUnsafe.mock.calls[idx];
      expect(sql).toContain(`UPDATE "${table}"`);
      expect(sql).toContain("array_remove");
      expect(code).toBe("onewave");
    }
    expect(db.crmBusinessUnit.delete).toHaveBeenCalledWith({
      where: { id: "bu-1" },
    });
  });

  it("404s on a missing row and never touches records", async () => {
    await expect(service.delete("nope")).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(db.$executeRawUnsafe).not.toHaveBeenCalled();
  });

  it("protects system rows", async () => {
    db.crmBusinessUnit.findUnique.mockResolvedValue({
      id: "bu-1",
      code: "onewave",
      isSystem: true,
    });

    await expect(service.delete("bu-1")).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(db.$executeRawUnsafe).not.toHaveBeenCalled();
  });
  it("deletes the unit's child rows and recomputes the deals it was on", async () => {
    // There is deliberately NO foreign key from the child rows to
    // CrmBusinessUnit, so array_remove strips the tag and leaves the child
    // row behind. An orphan keeps counting toward the deal's value and can
    // still be the least-advanced row, pinning the deal's stage to a unit
    // that no longer exists and that nobody can see.
    db.crmBusinessUnit.findUnique.mockResolvedValue({
      id: "bu-1",
      code: "onewave",
      isSystem: false,
    });
    db.opportunity.findMany.mockResolvedValue([{ id: "opp1" }, { id: "opp2" }]);
    db.revenueOpportunity.findMany.mockResolvedValue([{ id: "rev1" }]);

    await service.delete("bu-1");

    expect(db.opportunityBusinessUnit.deleteMany).toHaveBeenCalledWith({
      where: { businessUnit: "onewave" },
    });
    expect(db.revenueOpportunityBusinessUnit.deleteMany).toHaveBeenCalledWith({
      where: { businessUnit: "onewave" },
    });
    expect(salesRecompute).toHaveBeenCalledWith("opp1", expect.anything());
    expect(salesRecompute).toHaveBeenCalledWith("opp2", expect.anything());
    expect(revenueRecompute).toHaveBeenCalledWith("rev1", expect.anything());
  });

  it("collects the affected deals BEFORE stripping the tags", async () => {
    // Once array_remove has run, `businessUnits has code` matches nothing,
    // so a query issued afterwards would find no deals to recompute and
    // every one of them would keep a stale roll-up.
    const order: string[] = [];
    db.crmBusinessUnit.findUnique.mockResolvedValue({
      id: "bu-1",
      code: "onewave",
      isSystem: false,
    });
    db.opportunity.findMany.mockImplementation(async () => {
      order.push("collect");
      return [{ id: "opp1" }];
    });
    db.$executeRawUnsafe.mockImplementation(async () => {
      order.push("strip");
      return 1;
    });

    await service.delete("bu-1");

    // Both must actually have happened — indexOf returns -1 for a missing
    // entry, so a bare `<` comparison passes when the collect never ran.
    expect(order).toContain("collect");
    expect(order).toContain("strip");
    expect(order.indexOf("collect")).toBeLessThan(order.indexOf("strip"));
  });
});
