import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { prisma } from "@/infrastructure/database/prisma";
import { vendorsRepository } from "@/modules/vendors/vendors.repository";

// Mock the Prisma client. `$transaction` here just resolves the array of
// promises the repository passes it (findMany+count, and the 4 reference
// counts), so we can assert the `where` clauses without a real DB.
vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    vendor: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    invoice: { count: vi.fn().mockResolvedValue(0) },
    quote: { count: vi.fn().mockResolvedValue(0) },
    purchaseOrder: { count: vi.fn().mockResolvedValue(0) },
    creditNote: { count: vi.fn().mockResolvedValue(0) },
    $transaction: vi.fn((arg: unknown) =>
      Array.isArray(arg) ? Promise.all(arg) : (arg as () => unknown)(),
    ),
  },
}));

const vendorFindMany = prisma.vendor.findMany as unknown as Mock;
const vendorCount = prisma.vendor.count as unknown as Mock;
const vendorFindFirst = prisma.vendor.findFirst as unknown as Mock;
const invoiceCount = prisma.invoice.count as unknown as Mock;
const quoteCount = prisma.quote.count as unknown as Mock;
const poCount = prisma.purchaseOrder.count as unknown as Mock;
const creditNoteCount = prisma.creditNote.count as unknown as Mock;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("findMany — excludes soft-deleted", () => {
  it("filters both the list and the count on deletedAt: null", async () => {
    await vendorsRepository.findMany({ entityId: "e1" }, 1, 50);
    expect(vendorFindMany).toHaveBeenCalledTimes(1);
    expect(vendorCount).toHaveBeenCalledTimes(1);
    const listWhere = vendorFindMany.mock.calls[0][0].where;
    const countWhere = vendorCount.mock.calls[0][0].where;
    expect(listWhere.deletedAt).toBeNull();
    expect(countWhere.deletedAt).toBeNull();
    expect(listWhere.entityId).toBe("e1");
  });
});

describe("findById — excludes soft-deleted", () => {
  it("uses findFirst with a deletedAt: null guard", async () => {
    await vendorsRepository.findById("v1");
    expect(vendorFindFirst).toHaveBeenCalledTimes(1);
    const where = vendorFindFirst.mock.calls[0][0].where;
    expect(where.id).toBe("v1");
    expect(where.deletedAt).toBeNull();
  });
});

describe("countReferences", () => {
  it("counts all four relations by vendorId and sums them", async () => {
    invoiceCount.mockResolvedValue(2);
    quoteCount.mockResolvedValue(1);
    poCount.mockResolvedValue(0);
    creditNoteCount.mockResolvedValue(3);
    const res = await vendorsRepository.countReferences("v1");
    expect(invoiceCount).toHaveBeenCalledWith({ where: { vendorId: "v1" } });
    expect(quoteCount).toHaveBeenCalledWith({ where: { vendorId: "v1" } });
    expect(poCount).toHaveBeenCalledWith({ where: { vendorId: "v1" } });
    expect(creditNoteCount).toHaveBeenCalledWith({ where: { vendorId: "v1" } });
    expect(res.total).toBe(6);
  });
});

describe("findDuplicateByTaxId", () => {
  it("scopes to entity + taxId + branch, excludes self and soft-deleted", async () => {
    await vendorsRepository.findDuplicateByTaxId(
      "e1",
      "TIN123",
      "00000",
      "self",
    );
    const where = vendorFindFirst.mock.calls[0][0].where;
    expect(where.entityId).toBe("e1");
    expect(where.taxId).toBe("TIN123");
    expect(where.branchCode).toBe("00000");
    expect(where.deletedAt).toBeNull();
    expect(where.id).toEqual({ not: "self" });
  });
});
