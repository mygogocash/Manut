import type { Prisma } from "@manut/database";

import { prisma } from "@/infrastructure/database/prisma";
import type { VendorSortField } from "@/modules/vendors/vendors.validation";

const vendorInclude = {
  entity: { select: { id: true, name: true, code: true } },
} satisfies Prisma.VendorInclude;

export interface VendorFilters {
  entityId?: string;
  contactType?: string;
  businessType?: string;
  isActive?: boolean;
  search?: string;
  sortBy?: VendorSortField;
  sortOrder?: "asc" | "desc";
}

// Maps a column key (used by the UI header) to a Prisma `orderBy` clause.
// `branch` / `phone` are concatenated UI cells (branchCode · branch and
// phone · mobile) — we sort by the primary column to stay deterministic
// and append a `name` tie-breaker so equal values render in a stable
// order across pages.
function buildOrderBy(
  sortBy: VendorSortField | undefined,
  sortOrder: "asc" | "desc",
): Prisma.VendorOrderByWithRelationInput[] {
  const dir = sortOrder;
  const tail: Prisma.VendorOrderByWithRelationInput[] =
    sortBy && sortBy !== "name" ? [{ name: "asc" }] : [];
  switch (sortBy) {
    case "name":
      return [{ name: dir }];
    case "contactType":
      return [{ contactType: dir }, ...tail];
    case "businessType":
      return [{ businessType: dir }, ...tail];
    case "businessLocation":
      return [{ businessLocation: dir }, ...tail];
    case "taxId":
      return [{ taxId: dir }, ...tail];
    case "branch":
      return [{ branchCode: dir }, { branch: dir }, ...tail];
    case "contactName":
      return [{ contactName: dir }, ...tail];
    case "phone":
      return [{ phone: dir }, { mobile: dir }, ...tail];
    case "creditDays":
      return [{ creditDays: dir }, ...tail];
    case "entity":
      return [{ entity: { code: dir } }, ...tail];
    default:
      return [{ name: "asc" }];
  }
}

export class VendorsRepository {
  async findMany(filters: VendorFilters, page: number, limit: number) {
    const where: Prisma.VendorWhereInput = {};
    if (filters.entityId) where.entityId = filters.entityId;
    if (filters.contactType) where.contactType = filters.contactType;
    if (filters.businessType) where.businessType = filters.businessType;
    if (filters.isActive !== undefined) where.isActive = filters.isActive;
    if (filters.search) {
      const term = filters.search;
      where.OR = [
        { name: { contains: term, mode: "insensitive" } },
        { contactId: { contains: term, mode: "insensitive" } },
        { taxId: { contains: term, mode: "insensitive" } },
        { email: { contains: term, mode: "insensitive" } },
        { contactName: { contains: term, mode: "insensitive" } },
      ];
    }

    const [data, total] = await prisma.$transaction([
      prisma.vendor.findMany({
        where,
        include: vendorInclude,
        orderBy: buildOrderBy(filters.sortBy, filters.sortOrder ?? "asc"),
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.vendor.count({ where }),
    ]);
    return { data, total };
  }

  async findById(id: string) {
    return prisma.vendor.findUnique({
      where: { id },
      include: vendorInclude,
    });
  }

  async create(data: Prisma.VendorUncheckedCreateInput) {
    return prisma.vendor.create({ data, include: vendorInclude });
  }

  async update(id: string, data: Prisma.VendorUncheckedUpdateInput) {
    return prisma.vendor.update({
      where: { id },
      data,
      include: vendorInclude,
    });
  }

  async remove(id: string) {
    return prisma.vendor.delete({ where: { id } });
  }

  async deleteAllForEntity(entityId: string) {
    return prisma.vendor.deleteMany({ where: { entityId } });
  }

  // Returns the existing vendor for an entity matched by `contactId`
  // first (canonical identifier from the source system) and falling
  // back to `taxId`. Lets bulk-import upsert on re-runs.
  async findExistingForImport(
    entityId: string,
    contactId: string | null,
    taxId: string | null,
  ) {
    if (contactId) {
      const hit = await prisma.vendor.findFirst({
        where: { entityId, contactId },
        select: { id: true },
      });
      if (hit) return hit;
    }
    if (taxId) {
      const hit = await prisma.vendor.findFirst({
        where: { entityId, taxId },
        select: { id: true },
      });
      if (hit) return hit;
    }
    return null;
  }

  async createMany(rows: Array<Prisma.VendorUncheckedCreateInput>) {
    if (rows.length === 0) return { count: 0 };
    return prisma.vendor.createMany({ data: rows, skipDuplicates: false });
  }
}

export const vendorsRepository = new VendorsRepository();
