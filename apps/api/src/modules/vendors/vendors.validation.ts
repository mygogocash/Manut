import { z } from "zod";

function preprocessOmitEmptyToNull(val: unknown): unknown {
  if (val === undefined) return undefined;
  if (val === null || val === "") return null;
  return val;
}

const nullableString = z.preprocess(
  preprocessOmitEmptyToNull,
  z.union([z.string(), z.null()]).optional(),
);

const nullableInt = z.preprocess(
  (val) => {
    if (val === undefined) return undefined;
    if (val === null || val === "") return null;
    const n = Number(val);
    return Number.isFinite(n) ? Math.floor(n) : val;
  },
  z.union([z.number().int().nonnegative().max(3650), z.null()]).optional(),
);

export const createVendorSchema = z.object({
  entityId: z.string().min(1, "entityId is required"),
  contactType: z.string().max(100).optional(),
  contactId: z.string().max(100).optional(),
  businessType: z.string().max(100).optional(),
  businessLocation: z.string().max(100).optional(),
  name: z.string().min(1, "Name is required").max(500),
  addressTh: z.string().max(2000).optional(),
  addressEn: z.string().max(2000).optional(),
  address2: z.string().max(500).optional(),
  address3: z.string().max(500).optional(),
  zipCode: z.string().max(30).optional(),
  taxId: z.string().max(40).optional(),
  branchCode: z.string().max(30).optional(),
  branch: z.string().max(200).optional(),
  contactName: z.string().max(200).optional(),
  email: z.string().max(320).optional(),
  mobile: z.string().max(50).optional(),
  creditDays: z.coerce.number().int().nonnegative().max(3650).optional(),
  phone: z.string().max(50).optional(),
  faxNumber: z.string().max(50).optional(),
  notes: z.string().max(5000).optional(),
  isActive: z.coerce.boolean().optional().default(true),
});

export const updateVendorSchema = z.object({
  entityId: z.string().min(1).optional(),
  contactType: nullableString,
  contactId: nullableString,
  businessType: nullableString,
  businessLocation: nullableString,
  name: z.string().min(1).max(500).optional(),
  addressTh: nullableString,
  addressEn: nullableString,
  address2: nullableString,
  address3: nullableString,
  zipCode: nullableString,
  taxId: nullableString,
  branchCode: nullableString,
  branch: nullableString,
  contactName: nullableString,
  email: nullableString,
  mobile: nullableString,
  creditDays: nullableInt,
  phone: nullableString,
  faxNumber: nullableString,
  notes: nullableString,
  isActive: z.coerce.boolean().optional(),
});

// Columns that drive the Vendors table header. Whitelisted here so the
// table can't request an arbitrary Prisma path through query params.
export const VENDOR_SORT_FIELDS = [
  "name",
  "contactType",
  "businessType",
  "businessLocation",
  "taxId",
  "branch",
  "contactName",
  "phone",
  "creditDays",
  "entity",
] as const;
export type VendorSortField = (typeof VENDOR_SORT_FIELDS)[number];

export const vendorQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(50),
  entityId: z.string().min(1).optional(),
  contactType: z.string().max(100).optional(),
  businessType: z.string().max(100).optional(),
  isActive: z.preprocess((val) => {
    if (val === undefined || val === "") return undefined;
    if (val === "true" || val === true) return true;
    if (val === "false" || val === false) return false;
    return val;
  }, z.boolean().optional()),
  search: z.string().max(200).optional(),
  sortBy: z.enum(VENDOR_SORT_FIELDS).optional(),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
});

// Each row from the xlsx parser. We don't require entityId here —
// `commitImport` resolves it once per request from the caller.
export const importRowSchema = z.object({
  contactType: z.string().max(100).optional(),
  contactId: z.string().max(100).optional(),
  businessType: z.string().max(100).optional(),
  businessLocation: z.string().max(100).optional(),
  name: z.string().min(1, "name is required").max(500),
  addressTh: z.string().max(2000).optional(),
  addressEn: z.string().max(2000).optional(),
  address2: z.string().max(500).optional(),
  address3: z.string().max(500).optional(),
  zipCode: z.string().max(30).optional(),
  taxId: z.string().max(40).optional(),
  branchCode: z.string().max(30).optional(),
  branch: z.string().max(200).optional(),
  contactName: z.string().max(200).optional(),
  email: z.string().max(320).optional(),
  mobile: z.string().max(50).optional(),
  creditDays: z.coerce.number().int().nonnegative().max(3650).optional(),
  phone: z.string().max(50).optional(),
  faxNumber: z.string().max(50).optional(),
});

export const bulkImportSchema = z.object({
  entityId: z.string().min(1, "entityId is required"),
  // Replace-all wipes every existing vendor for the entity before
  // inserting. Append (default) just adds — duplicates with the
  // same contactId or taxId fall through to update.
  mode: z.enum(["append", "replace"]).default("append"),
  rows: z.array(importRowSchema).min(1).max(5000),
});

export type CreateVendorInput = z.infer<typeof createVendorSchema>;
export type UpdateVendorInput = z.infer<typeof updateVendorSchema>;
export type VendorQuery = z.infer<typeof vendorQuerySchema>;
export type ImportRow = z.infer<typeof importRowSchema>;
export type BulkImportInput = z.infer<typeof bulkImportSchema>;
