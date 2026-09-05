import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import {
  ConflictException,
  NotFoundException,
} from "@/common/exceptions/http-exception";
import { logAudit } from "@/infrastructure/audit/audit.service";
import { vendorsRepository as repo } from "@/modules/vendors/vendors.repository";
import { VendorsService } from "@/modules/vendors/vendors.service";

vi.mock("@/infrastructure/audit/audit.service", () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}));

// Service never touches prisma directly except in bulkImport (not exercised
// here); stub the module so importing the service doesn't spin a real client.
vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: { entity: { findUnique: vi.fn() } },
}));

vi.mock("@/modules/vendors/vendors.repository", () => ({
  vendorsRepository: {
    findMany: vi.fn(),
    findById: vi.fn(),
    findByIdIncludingDeleted: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    softRemove: vi.fn(),
    restore: vi.fn(),
    countReferences: vi.fn(),
    findDuplicateByTaxId: vi.fn(),
    findNameMatches: vi.fn(),
    deleteAllForEntity: vi.fn(),
    findExistingForImport: vi.fn(),
  },
}));

const findById = repo.findById as Mock;
const create = repo.create as Mock;
const update = repo.update as Mock;
const softRemove = repo.softRemove as Mock;
const countReferences = repo.countReferences as Mock;
const findDuplicateByTaxId = repo.findDuplicateByTaxId as Mock;
const findNameMatches = repo.findNameMatches as Mock;

const service = new VendorsService();
const ENTITY_A = "entity-a";
const ENTITY_B = "entity-b";

function vendorRow(over: Record<string, unknown> = {}) {
  return {
    id: "vendor-1",
    entityId: ENTITY_A,
    name: "Acme Co., Ltd.",
    taxId: "1234567890123",
    branchCode: "00000",
    addressTh: null,
    addressEn: null,
    paymentTerms: null,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: no clash, no similar name — individual tests override.
  findDuplicateByTaxId.mockResolvedValue(null);
  findNameMatches.mockResolvedValue([]);
  create.mockImplementation(async (data: Record<string, unknown>) => ({
    id: "vendor-new",
    ...data,
  }));
  update.mockImplementation(
    async (id: string, data: Record<string, unknown>) => ({
      id,
      ...data,
    }),
  );
});

describe("create — uniqueness", () => {
  it("rejects a duplicate (taxId, branchCode) in the same entity", async () => {
    findDuplicateByTaxId.mockResolvedValue({
      id: "other",
      name: "Existing Co",
      taxId: "1234567890123",
      branchCode: "00000",
    });
    await expect(
      service.create({
        entityId: ENTITY_A,
        name: "Acme",
        taxId: "1234567890123",
        branchCode: "00000",
        isActive: true,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(create).not.toHaveBeenCalled();
  });

  it("allows an empty taxId without checking for duplicates", async () => {
    await service.create({
      entityId: ENTITY_A,
      name: "Cash Sale",
      taxId: "",
      isActive: true,
    });
    expect(findDuplicateByTaxId).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("allows the same taxId in a different entity", async () => {
    // Duplicate lookup is entity-scoped in the repo; here it returns null.
    findDuplicateByTaxId.mockResolvedValue(null);
    await service.create({
      entityId: ENTITY_B,
      name: "Acme",
      taxId: "1234567890123",
      branchCode: "00000",
      isActive: true,
    });
    expect(findDuplicateByTaxId).toHaveBeenCalledWith(
      ENTITY_B,
      "1234567890123",
      "00000",
      undefined,
    );
    expect(create).toHaveBeenCalledTimes(1);
  });
});

describe("create — name similarity warning", () => {
  it("returns a non-blocking warning but still creates", async () => {
    findNameMatches.mockResolvedValue([{ id: "v9", name: "Acme Holdings" }]);
    const res = await service.create({
      entityId: ENTITY_A,
      name: "Acme",
      isActive: true,
    });
    expect(create).toHaveBeenCalledTimes(1);
    expect(res.data).toBeDefined();
    expect(res.warning?.code).toBe("name-similarity");
    expect(res.warning?.matches).toHaveLength(1);
  });

  it("omits the warning when there is no close match", async () => {
    findNameMatches.mockResolvedValue([]);
    const res = await service.create({
      entityId: ENTITY_A,
      name: "Totally Unique Co",
      isActive: true,
    });
    expect(res.warning).toBeUndefined();
    expect(create).toHaveBeenCalledTimes(1);
  });
});

describe("update — uniqueness", () => {
  it("rejects a clashing (taxId, branchCode), excluding self", async () => {
    findById.mockResolvedValue(vendorRow());
    findDuplicateByTaxId.mockResolvedValue({
      id: "other",
      name: "Existing Co",
      taxId: "9999999999999",
      branchCode: "00001",
    });
    await expect(
      service.update("vendor-1", {
        taxId: "9999999999999",
        branchCode: "00001",
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(findDuplicateByTaxId).toHaveBeenCalledWith(
      ENTITY_A,
      "9999999999999",
      "00001",
      "vendor-1",
    );
    expect(update).not.toHaveBeenCalled();
  });

  it("keeps the existing taxId when the field is not in the patch", async () => {
    findById.mockResolvedValue(vendorRow());
    await service.update("vendor-1", { name: "Acme Renamed" });
    // Effective taxId/branch fall back to the existing row values.
    expect(findDuplicateByTaxId).toHaveBeenCalledWith(
      ENTITY_A,
      "1234567890123",
      "00000",
      "vendor-1",
    );
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("audits taxId / address / paymentTerms changes", async () => {
    findById.mockResolvedValue(vendorRow());
    await service.update("vendor-1", { taxId: "0000000000000" });
    expect(logAudit).toHaveBeenCalledTimes(1);
    const call = (logAudit as Mock).mock.calls[0][0];
    expect(call.resource).toBe("vendor");
    expect(call.details.changed.taxId).toEqual({
      before: "1234567890123",
      after: "0000000000000",
    });
  });

  it("does not audit when no document-affecting field changed", async () => {
    findById.mockResolvedValue(vendorRow());
    await service.update("vendor-1", { email: "new@x.com" });
    expect(logAudit).not.toHaveBeenCalled();
  });
});

describe("remove — deactivate-not-delete + soft delete", () => {
  it("blocks deletion of a referenced vendor and leaves it intact", async () => {
    findById.mockResolvedValue(vendorRow());
    countReferences.mockResolvedValue({
      invoices: 2,
      quotes: 0,
      purchaseOrders: 1,
      creditNotes: 0,
      total: 3,
    });
    await expect(service.remove("vendor-1")).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(softRemove).not.toHaveBeenCalled();
  });

  it("soft-deletes an unreferenced vendor", async () => {
    findById.mockResolvedValue(vendorRow());
    countReferences.mockResolvedValue({
      invoices: 0,
      quotes: 0,
      purchaseOrders: 0,
      creditNotes: 0,
      total: 0,
    });
    softRemove.mockResolvedValue(vendorRow({ deletedAt: new Date() }));
    const res = await service.remove("vendor-1");
    expect(softRemove).toHaveBeenCalledWith("vendor-1");
    expect(res.data).toEqual({ id: "vendor-1" });
  });

  it("404s when the vendor does not exist", async () => {
    findById.mockResolvedValue(null);
    await expect(service.remove("missing")).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(countReferences).not.toHaveBeenCalled();
  });
});
