import type { Prisma } from "@nexora/database";

import { prisma } from "@/infrastructure/database/prisma";
import {
  excludeDeleted,
  restoreUpdate,
  softDeleteUpdate,
} from "@/infrastructure/soft-delete";
import type { VendorSortField } from "@/modules/vendors/vendors.validation";

const vendorInclude = {
  entity: { select: { id: true, name: true, code: true } },
  mergedInto: { select: { id: true, name: true, contactId: true } },
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
    // Every list/count excludes soft-deleted rows so removed vendors drop out
    // of pickers/tables while their AR/AP history stays intact.
    const where: Prisma.VendorWhereInput = { ...excludeDeleted("deletedAt") };
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

  // Default read path — excludes soft-deleted rows (findUnique can't take a
  // deletedAt filter, so use findFirst with the id + deletedAt: null).
  async findById(id: string) {
    return prisma.vendor.findFirst({
      where: { id, ...excludeDeleted("deletedAt") },
      include: vendorInclude,
    });
  }

  // Restore / permanent paths must see soft-deleted rows too — otherwise a
  // restore always 404s (the default findById hides them).
  async findByIdIncludingDeleted(id: string) {
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

  // Soft delete: stamp deletedAt so history (invoices/quotes/POs still
  // referencing this vendor) stays intact.
  async softRemove(id: string) {
    return prisma.vendor.update({
      where: { id },
      data: softDeleteUpdate("deletedAt"),
      include: vendorInclude,
    });
  }

  async restore(id: string) {
    return prisma.vendor.update({
      where: { id },
      data: restoreUpdate("deletedAt"),
      include: vendorInclude,
    });
  }

  // Count AR/AP documents referencing this vendor across all four relations.
  // Any non-zero count means the vendor carries transaction history and must
  // be deactivated rather than deleted (M1.1.6 / Rule 3).
  async countReferences(id: string) {
    const [invoices, quotes, purchaseOrders, creditNotes] =
      await prisma.$transaction([
        prisma.invoice.count({ where: { vendorId: id } }),
        prisma.quote.count({ where: { vendorId: id } }),
        prisma.purchaseOrder.count({ where: { vendorId: id } }),
        prisma.creditNote.count({ where: { vendorId: id } }),
      ]);
    return {
      invoices,
      quotes,
      purchaseOrders,
      creditNotes,
      total: invoices + quotes + purchaseOrders + creditNotes,
    };
  }

  // Finds another non-deleted vendor in the same entity carrying the same
  // (taxId, branchCode). Service-layer uniqueness only — no DB constraint (see
  // the note in vendors.service.ts).
  async findDuplicateByTaxId(
    entityId: string,
    taxId: string,
    branchCode: string | null,
    excludeId?: string,
  ) {
    return prisma.vendor.findFirst({
      where: {
        entityId,
        taxId,
        branchCode: branchCode ?? null,
        ...excludeDeleted("deletedAt"),
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true, name: true, taxId: true, branchCode: true },
    });
  }

  // Non-fuzzy name-similarity lookup: non-deleted vendors in the entity whose
  // name case-insensitively starts with (or equals) the candidate name. Feeds
  // the non-blocking create-time warning.
  async findNameMatches(entityId: string, name: string, excludeId?: string) {
    return prisma.vendor.findMany({
      where: {
        entityId,
        name: { startsWith: name, mode: "insensitive" },
        ...excludeDeleted("deletedAt"),
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true, name: true },
      take: 5,
    });
  }

  async deleteAllForEntity(entityId: string) {
    return prisma.vendor.deleteMany({ where: { entityId } });
  }

  // Returns the existing (non-deleted) vendor for an entity matched by
  // `contactId` first (canonical identifier from the source system) and
  // falling back to `taxId`. Lets bulk-import upsert on re-runs.
  async findExistingForImport(
    entityId: string,
    contactId: string | null,
    taxId: string | null,
  ) {
    if (contactId) {
      const hit = await prisma.vendor.findFirst({
        where: { entityId, contactId, ...excludeDeleted("deletedAt") },
        select: { id: true },
      });
      if (hit) return hit;
    }
    if (taxId) {
      const hit = await prisma.vendor.findFirst({
        where: { entityId, taxId, ...excludeDeleted("deletedAt") },
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
