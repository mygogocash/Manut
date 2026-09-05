import type { Request } from "express";

import {
  ConflictException,
  NotFoundException,
} from "@/common/exceptions/http-exception";
import { logAudit } from "@/infrastructure/audit/audit.service";
import { prisma } from "@/infrastructure/database/prisma";
import { vendorsRepository } from "@/modules/vendors/vendors.repository";
import type {
  BulkImportInput,
  CreateVendorInput,
  UpdateVendorInput,
  VendorQuery,
} from "@/modules/vendors/vendors.validation";

const RESOURCE = "vendor";

// Non-blocking warning surfaced back to the caller (e.g. a close name match on
// create). Never throws — the write still succeeds.
export interface VendorWarning {
  code: "name-similarity";
  message: string;
  matches: Array<{ id: string; name: string }>;
}

function isNonEmpty(v: string | null | undefined): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

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

  // Uniqueness is enforced HERE, not by a DB constraint: existing production
  // rows may share or NULL out taxId, and a hard UNIQUE index would fail the
  // migration. A DB-level partial unique index on
  // (entity_id, tax_id, branch_code) WHERE tax_id <> '' should follow AFTER a
  // one-off dedup audit of live data.
  private async assertUniqueTaxId(
    entityId: string,
    taxId: string | null | undefined,
    branchCode: string | null | undefined,
    excludeId?: string,
  ) {
    if (!isNonEmpty(taxId)) return; // empty / null taxId never clashes
    const clash = await vendorsRepository.findDuplicateByTaxId(
      entityId,
      taxId,
      branchCode ?? null,
      excludeId,
    );
    if (clash) {
      const branchSuffix = branchCode ? ` / branch ${branchCode}` : "";
      throw new ConflictException(
        `Another contact ("${clash.name}") in this entity already uses tax ID ${taxId}${branchSuffix}.`,
      );
    }
  }

  // Simple (non-fuzzy) close-name check for the create flow. Returns a soft
  // warning when a non-deleted contact in the same entity has a name that
  // case-insensitively starts with the new one. Never blocks.
  private async nameSimilarityWarning(
    entityId: string,
    name: string,
    excludeId?: string,
  ): Promise<VendorWarning | undefined> {
    const trimmed = name.trim();
    if (trimmed.length === 0) return undefined;
    const matches = await vendorsRepository.findNameMatches(
      entityId,
      trimmed,
      excludeId,
    );
    if (matches.length === 0) return undefined;
    return {
      code: "name-similarity",
      message: `A similar contact name already exists in this entity: ${matches
        .map((m) => `"${m.name}"`)
        .join(", ")}. Create anyway if this is a different contact.`,
      matches,
    };
  }

  async create(input: CreateVendorInput) {
    await this.assertUniqueTaxId(input.entityId, input.taxId, input.branchCode);
    const warning = await this.nameSimilarityWarning(
      input.entityId,
      input.name,
    );
    const vendor = await vendorsRepository.create({
      entityId: input.entityId,
      contactType: input.contactType,
      contactId: input.contactId,
      businessType: input.businessType,
      businessLocation: input.businessLocation,
      name: input.name,
      nameTh: input.nameTh,
      nameEn: input.nameEn,
      addressTh: input.addressTh,
      addressEn: input.addressEn,
      address2: input.address2,
      address3: input.address3,
      deliveryAddressTh: input.deliveryAddressTh,
      deliveryAddressEn: input.deliveryAddressEn,
      zipCode: input.zipCode,
      taxId: input.taxId,
      branchCode: input.branchCode,
      branch: input.branch,
      contactName: input.contactName,
      email: input.email,
      mobile: input.mobile,
      creditDays: input.creditDays,
      paymentTerms: input.paymentTerms,
      defaultCurrency: input.defaultCurrency,
      taxTreatment: input.taxTreatment,
      defaultRevenueAccountId: input.defaultRevenueAccountId,
      defaultExpenseAccountId: input.defaultExpenseAccountId,
      defaultWhtRate: input.defaultWhtRate,
      creditLimit: input.creditLimit,
      phone: input.phone,
      faxNumber: input.faxNumber,
      notes: input.notes,
      isActive: input.isActive ?? true,
    });
    // `warning` is a sibling of `data` so the write still succeeds; the client
    // shows it as a non-blocking note.
    return { data: vendor, warning };
  }

  async update(id: string, input: UpdateVendorInput, req?: Request) {
    const existing = await vendorsRepository.findById(id);
    if (!existing) throw new NotFoundException("Vendor not found");

    // Resolve the effective (entity, taxId, branchCode) after this partial
    // update to run the uniqueness check against the final state.
    const effEntityId = input.entityId ?? existing.entityId;
    const effTaxId = input.taxId !== undefined ? input.taxId : existing.taxId;
    const effBranchCode =
      input.branchCode !== undefined ? input.branchCode : existing.branchCode;
    await this.assertUniqueTaxId(effEntityId, effTaxId, effBranchCode, id);

    const vendor = await vendorsRepository.update(id, {
      entityId: input.entityId,
      contactType: input.contactType,
      contactId: input.contactId,
      businessType: input.businessType,
      businessLocation: input.businessLocation,
      name: input.name,
      nameTh: input.nameTh,
      nameEn: input.nameEn,
      addressTh: input.addressTh,
      addressEn: input.addressEn,
      address2: input.address2,
      address3: input.address3,
      deliveryAddressTh: input.deliveryAddressTh,
      deliveryAddressEn: input.deliveryAddressEn,
      zipCode: input.zipCode,
      taxId: input.taxId,
      branchCode: input.branchCode,
      branch: input.branch,
      contactName: input.contactName,
      email: input.email,
      mobile: input.mobile,
      creditDays: input.creditDays,
      paymentTerms: input.paymentTerms,
      defaultCurrency: input.defaultCurrency,
      taxTreatment: input.taxTreatment,
      defaultRevenueAccountId: input.defaultRevenueAccountId,
      defaultExpenseAccountId: input.defaultExpenseAccountId,
      defaultWhtRate: input.defaultWhtRate,
      creditLimit: input.creditLimit,
      phone: input.phone,
      faxNumber: input.faxNumber,
      notes: input.notes,
      isActive: input.isActive,
    });

    // Audit the document-affecting fields (they print on invoices / affect
    // payment scheduling), recording before/after only for those that changed.
    const auditFields: Array<keyof UpdateVendorInput> = [
      "taxId",
      "addressTh",
      "addressEn",
      "paymentTerms",
    ];
    const changed: Record<string, { before: unknown; after: unknown }> = {};
    for (const f of auditFields) {
      if (input[f] !== undefined && input[f] !== existing[f]) {
        changed[f] = { before: existing[f], after: input[f] };
      }
    }
    if (Object.keys(changed).length > 0) {
      void logAudit({
        action: "update",
        resource: RESOURCE,
        resourceId: id,
        details: { changed },
        req,
      });
    }

    return { data: vendor };
  }

  // Deactivate-not-delete (M1.1.6 / Rule 3): a vendor referenced by any AR/AP
  // document is never removed — the caller must deactivate it (isActive:false)
  // instead. An unreferenced vendor is soft-deleted so it leaves pickers while
  // the row survives for audit.
  async remove(id: string, req?: Request) {
    const existing = await vendorsRepository.findById(id);
    if (!existing) throw new NotFoundException("Vendor not found");

    const refs = await vendorsRepository.countReferences(id);
    if (refs.total > 0) {
      throw new ConflictException(
        `Cannot delete "${existing.name}" — it is referenced by ${refs.total} document(s) ` +
          `(${refs.invoices} invoice, ${refs.quotes} quote, ${refs.purchaseOrders} purchase order, ` +
          `${refs.creditNotes} credit note). Deactivate it instead.`,
      );
    }

    await vendorsRepository.softRemove(id);
    void logAudit({
      action: "soft_delete",
      resource: RESOURCE,
      resourceId: id,
      details: { name: existing.name },
      req,
    });
    return { data: { id } };
  }

  async restore(id: string, req?: Request) {
    // Must look through the soft-delete filter or the restore always 404s.
    const existing = await vendorsRepository.findByIdIncludingDeleted(id);
    if (!existing) throw new NotFoundException("Vendor not found");
    const vendor = await vendorsRepository.restore(id);
    void logAudit({
      action: "restore",
      resource: RESOURCE,
      resourceId: id,
      details: { name: existing.name },
      req,
    });
    return { data: vendor };
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
