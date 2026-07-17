import { NotFoundException } from "@/common/exceptions/http-exception";
import { prisma } from "@/infrastructure/database/prisma";
import { vendorsRepository } from "@/modules/vendors/vendors.repository";
import type {
  BulkImportInput,
  CreateVendorInput,
  UpdateVendorInput,
  VendorQuery,
} from "@/modules/vendors/vendors.validation";

export class VendorsService {
  async list(query: VendorQuery) {
    const { page, limit, ...filters } = query;
    const { data, total } = await vendorsRepository.findMany(
      filters,
      page,
      limit,
    );
    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getById(id: string) {
    const vendor = await vendorsRepository.findById(id);
    if (!vendor) throw new NotFoundException("Vendor not found");
    return { data: vendor };
  }

  async create(input: CreateVendorInput) {
    const vendor = await vendorsRepository.create({
      entityId: input.entityId,
      contactType: input.contactType,
      contactId: input.contactId,
      businessType: input.businessType,
      businessLocation: input.businessLocation,
      name: input.name,
      addressTh: input.addressTh,
      addressEn: input.addressEn,
      address2: input.address2,
      address3: input.address3,
      zipCode: input.zipCode,
      taxId: input.taxId,
      branchCode: input.branchCode,
      branch: input.branch,
      contactName: input.contactName,
      email: input.email,
      mobile: input.mobile,
      creditDays: input.creditDays,
      phone: input.phone,
      faxNumber: input.faxNumber,
      notes: input.notes,
      isActive: input.isActive ?? true,
    });
    return { data: vendor };
  }

  async update(id: string, input: UpdateVendorInput) {
    const existing = await vendorsRepository.findById(id);
    if (!existing) throw new NotFoundException("Vendor not found");
    const vendor = await vendorsRepository.update(id, {
      entityId: input.entityId,
      contactType: input.contactType,
      contactId: input.contactId,
      businessType: input.businessType,
      businessLocation: input.businessLocation,
      name: input.name,
      addressTh: input.addressTh,
      addressEn: input.addressEn,
      address2: input.address2,
      address3: input.address3,
      zipCode: input.zipCode,
      taxId: input.taxId,
      branchCode: input.branchCode,
      branch: input.branch,
      contactName: input.contactName,
      email: input.email,
      mobile: input.mobile,
      creditDays: input.creditDays,
      phone: input.phone,
      faxNumber: input.faxNumber,
      notes: input.notes,
      isActive: input.isActive,
    });
    return { data: vendor };
  }

  async remove(id: string) {
    const existing = await vendorsRepository.findById(id);
    if (!existing) throw new NotFoundException("Vendor not found");
    await vendorsRepository.remove(id);
    return { data: { id } };
  }

  /**
   * Bulk-import vendors from a parsed xlsx. The dialog parses headers
   * → field keys client-side; we trust the shape but enforce per-row
   * validation via the Zod schema in the controller. `append` upserts
   * on `(entityId, contactId)` then `(entityId, taxId)`; `replace`
   * wipes existing rows for the entity first.
   */
  async bulkImport(input: BulkImportInput) {
    const entity = await prisma.entity.findUnique({
      where: { id: input.entityId },
      select: { id: true },
    });
    if (!entity) throw new NotFoundException("Entity not found");

    let removed = 0;
    if (input.mode === "replace") {
      const res = await vendorsRepository.deleteAllForEntity(input.entityId);
      removed = res.count;
    }

    let inserted = 0;
    let updated = 0;

    for (const row of input.rows) {
      const existing =
        input.mode === "replace"
          ? null
          : await vendorsRepository.findExistingForImport(
              input.entityId,
              row.contactId ?? null,
              row.taxId ?? null,
            );

      const payload = {
        entityId: input.entityId,
        contactType: row.contactType,
        contactId: row.contactId,
        businessType: row.businessType,
        businessLocation: row.businessLocation,
        name: row.name,
        addressTh: row.addressTh,
        addressEn: row.addressEn,
        address2: row.address2,
        address3: row.address3,
        zipCode: row.zipCode,
        taxId: row.taxId,
        branchCode: row.branchCode,
        branch: row.branch,
        contactName: row.contactName,
        email: row.email,
        mobile: row.mobile,
        creditDays: row.creditDays,
        phone: row.phone,
        faxNumber: row.faxNumber,
      } as const;

      if (existing) {
        await vendorsRepository.update(existing.id, payload);
        updated += 1;
      } else {
        await vendorsRepository.create(payload);
        inserted += 1;
      }
    }

    return {
      data: {
        mode: input.mode,
        entityId: input.entityId,
        removed,
        inserted,
        updated,
        total: input.rows.length,
      },
    };
  }
}

export const vendorsService = new VendorsService();
