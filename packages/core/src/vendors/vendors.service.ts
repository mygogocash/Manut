import type {
  BulkImportInput,
  CreateVendorInput,
  UpdateVendorInput,
  VendorQuery,
} from "@nexora/contracts/modules/vendors/vendors.validation";
import type { Db } from "@nexora/db";
import { ConflictException, NotFoundException } from "../http-exception";
import * as repo from "./vendors.repository";

export interface VendorWarning {
  code: "name-similarity";
  message: string;
  matches: Array<{ id: string; name: string }>;
}

function isNonEmpty(v: string | null | undefined): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function numOrNull(v: number | undefined | null): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  return String(v);
}

async function assertUniqueTaxId(
  db: Db,
  entityId: string,
  taxId: string | null | undefined,
  branchCode: string | null | undefined,
  excludeId?: string,
) {
  if (!isNonEmpty(taxId)) return;
  const clash = await repo.findDuplicateByTaxId(db, entityId, taxId, branchCode ?? null, excludeId);
  if (clash) {
    const branchSuffix = branchCode ? ` / branch ${branchCode}` : "";
    throw new ConflictException(
      `Another contact ("${clash.name}") in this entity already uses tax ID ${taxId}${branchSuffix}.`,
    );
  }
}

async function nameSimilarityWarning(
  db: Db,
  entityId: string,
  name: string,
  excludeId?: string,
): Promise<VendorWarning | undefined> {
  const trimmed = name.trim();
  if (!trimmed) return undefined;
  const matches = await repo.findNameMatches(db, entityId, trimmed, excludeId);
  if (matches.length === 0) return undefined;
  return {
    code: "name-similarity",
    message: `A similar contact name already exists in this entity: ${matches.map((m) => `"${m.name}"`).join(", ")}. Create anyway if this is a different contact.`,
    matches,
  };
}

function mapCreateInput(input: CreateVendorInput) {
  return {
    entityId: input.entityId,
    contactType: input.contactType ?? null,
    contactId: input.contactId ?? null,
    businessType: input.businessType ?? null,
    businessLocation: input.businessLocation ?? null,
    name: input.name,
    nameTh: input.nameTh ?? null,
    nameEn: input.nameEn ?? null,
    addressTh: input.addressTh ?? null,
    addressEn: input.addressEn ?? null,
    address2: input.address2 ?? null,
    address3: input.address3 ?? null,
    deliveryAddressTh: input.deliveryAddressTh ?? null,
    deliveryAddressEn: input.deliveryAddressEn ?? null,
    zipCode: input.zipCode ?? null,
    taxId: input.taxId ?? null,
    branchCode: input.branchCode ?? null,
    branch: input.branch ?? null,
    contactName: input.contactName ?? null,
    email: input.email ?? null,
    mobile: input.mobile ?? null,
    creditDays: input.creditDays ?? null,
    paymentTerms: input.paymentTerms ?? null,
    defaultCurrency: input.defaultCurrency ?? null,
    taxTreatment: input.taxTreatment ?? null,
    defaultRevenueAccountId: input.defaultRevenueAccountId ?? null,
    defaultExpenseAccountId: input.defaultExpenseAccountId ?? null,
    defaultWhtRate: numOrNull(input.defaultWhtRate) ?? null,
    creditLimit: numOrNull(input.creditLimit) ?? null,
    phone: input.phone ?? null,
    faxNumber: input.faxNumber ?? null,
    notes: input.notes ?? null,
    isActive: input.isActive ?? true,
  };
}

export async function list(db: Db, query: VendorQuery) {
  const { page, limit, ...filters } = query;
  const { data, total } = await repo.findMany(db, filters, page, limit);
  return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getById(db: Db, id: string) {
  const vendor = await repo.findById(db, id);
  if (!vendor) throw new NotFoundException("Vendor not found");
  return vendor;
}

export async function create(db: Db, input: CreateVendorInput) {
  await assertUniqueTaxId(db, input.entityId, input.taxId, input.branchCode);
  const warning = await nameSimilarityWarning(db, input.entityId, input.name);
  const vendor = await repo.create(db, mapCreateInput(input));
  return { data: vendor, warning };
}

export async function update(db: Db, id: string, input: UpdateVendorInput) {
  const existing = await repo.findById(db, id);
  if (!existing) throw new NotFoundException("Vendor not found");
  const effEntityId = input.entityId ?? existing.entityId;
  const effTaxId = input.taxId !== undefined ? input.taxId : existing.taxId;
  const effBranchCode = input.branchCode !== undefined ? input.branchCode : existing.branchCode;
  await assertUniqueTaxId(db, effEntityId, effTaxId, effBranchCode, id);

  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined) continue;
    if (k === "defaultWhtRate" || k === "creditLimit") patch[k] = numOrNull(v as number | null);
    else patch[k] = v;
  }
  const vendor = await repo.update(db, id, patch as never);
  return { data: vendor };
}

export async function remove(db: Db, id: string) {
  const existing = await repo.findById(db, id);
  if (!existing) throw new NotFoundException("Vendor not found");
  const refs = await repo.countReferences(db, id);
  if (refs.total > 0) {
    throw new ConflictException(
      `Cannot delete "${existing.name}" — it is referenced by ${refs.total} document(s) ` +
        `(${refs.invoices} invoice, ${refs.quotes} quote, ${refs.purchaseOrders} purchase order, ` +
        `${refs.creditNotes} credit note). Deactivate it instead.`,
    );
  }
  await repo.softRemove(db, id);
  return { data: { id } };
}

export async function restore(db: Db, id: string) {
  const existing = await repo.findByIdIncludingDeleted(db, id);
  if (!existing) throw new NotFoundException("Vendor not found");
  const vendor = await repo.restore(db, id);
  return { data: vendor };
}

export async function bulkImport(db: Db, input: BulkImportInput) {
  const exists = await repo.entityExists(db, input.entityId);
  if (!exists) throw new NotFoundException("Entity not found");

  let removed = 0;
  if (input.mode === "replace") {
    const res = await repo.deleteAllForEntity(db, input.entityId);
    removed = res.count;
  }

  let inserted = 0;
  let updated = 0;
  for (const row of input.rows) {
    const existing =
      input.mode === "replace"
        ? null
        : await repo.findExistingForImport(db, input.entityId, row.contactId ?? null, row.taxId ?? null);
    const payload = {
      entityId: input.entityId,
      contactType: row.contactType ?? null,
      contactId: row.contactId ?? null,
      businessType: row.businessType ?? null,
      businessLocation: row.businessLocation ?? null,
      name: row.name,
      addressTh: row.addressTh ?? null,
      addressEn: row.addressEn ?? null,
      address2: row.address2 ?? null,
      address3: row.address3 ?? null,
      zipCode: row.zipCode ?? null,
      taxId: row.taxId ?? null,
      branchCode: row.branchCode ?? null,
      branch: row.branch ?? null,
      contactName: row.contactName ?? null,
      email: row.email ?? null,
      mobile: row.mobile ?? null,
      creditDays: row.creditDays ?? null,
      phone: row.phone ?? null,
      faxNumber: row.faxNumber ?? null,
      isActive: true,
    };
    if (existing) {
      await repo.update(db, existing.id, payload);
      updated += 1;
    } else {
      await repo.create(db, payload);
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
