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

// Empty string / null → null; otherwise coerce to a finite non-negative number.
// Used for the Decimal columns (creditLimit, defaultWhtRate) on update.
function nullableDecimal(max: number) {
  return z.preprocess(
    (val) => {
      if (val === undefined) return undefined;
      if (val === null || val === "") return null;
      const n = Number(val);
      return Number.isFinite(n) ? n : val;
    },
    z.union([z.number().nonnegative().max(max), z.null()]).optional(),
  );
}

// Payment-term keyword (mirrors Invoice.paymentTerms free text but constrained
// on the master). `custom` defers to the exact `creditDays` day count.
export const PAYMENT_TERMS = [
  "cash",
  "net7",
  "net14",
  "net30",
  "net45",
  "net60",
  "net90",
  "eom",
  "custom",
] as const;

// Thai tax treatment: standard VAT 7%, zero-rated, or exempt.
export const TAX_TREATMENTS = ["vat7", "vat0", "exempt"] as const;

const nullablePaymentTerms = z.preprocess(
  preprocessOmitEmptyToNull,
  z.union([z.enum(PAYMENT_TERMS), z.null()]).optional(),
);

const nullableTaxTreatment = z.preprocess(
  preprocessOmitEmptyToNull,
  z.union([z.enum(TAX_TREATMENTS), z.null()]).optional(),
);

export const createVendorSchema = z.object({
  entityId: z.string().min(1, "entityId is required"),
  contactType: z.string().max(100).optional(),
  contactId: z.string().max(100).optional(),
  businessType: z.string().max(100).optional(),
  businessLocation: z.string().max(100).optional(),
  name: z.string().min(1, "Name is required").max(500),
  nameTh: z.string().max(500).optional(),
  nameEn: z.string().max(500).optional(),
  addressTh: z.string().max(2000).optional(),
  addressEn: z.string().max(2000).optional(),
  address2: z.string().max(500).optional(),
  address3: z.string().max(500).optional(),
  deliveryAddressTh: z.string().max(2000).optional(),
  deliveryAddressEn: z.string().max(2000).optional(),
  zipCode: z.string().max(30).optional(),
  taxId: z.string().max(40).optional(),
  branchCode: z.string().max(30).optional(),
  branch: z.string().max(200).optional(),
  contactName: z.string().max(200).optional(),
  email: z.string().max(320).optional(),
  mobile: z.string().max(50).optional(),
  creditDays: z.coerce.number().int().nonnegative().max(3650).optional(),
  paymentTerms: z.enum(PAYMENT_TERMS).optional(),
  defaultCurrency: z.string().max(10).optional(),
  taxTreatment: z.enum(TAX_TREATMENTS).optional(),
  defaultRevenueAccountId: z.string().max(64).optional(),
  defaultExpenseAccountId: z.string().max(64).optional(),
  defaultWhtRate: z.coerce.number().nonnegative().max(100).optional(),
  creditLimit: z.coerce
    .number()
    .nonnegative()
    .max(1_000_000_000_000)
    .optional(),
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
  nameTh: nullableString,
  nameEn: nullableString,
  addressTh: nullableString,
  addressEn: nullableString,
  address2: nullableString,
  address3: nullableString,
  deliveryAddressTh: nullableString,
  deliveryAddressEn: nullableString,
  zipCode: nullableString,
  taxId: nullableString,
  branchCode: nullableString,
  branch: nullableString,
  contactName: nullableString,
  email: nullableString,
  mobile: nullableString,
  creditDays: nullableInt,
  paymentTerms: nullablePaymentTerms,
  defaultCurrency: nullableString,
  taxTreatment: nullableTaxTreatment,
  defaultRevenueAccountId: nullableString,
  defaultExpenseAccountId: nullableString,
  defaultWhtRate: nullableDecimal(100),
  creditLimit: nullableDecimal(1_000_000_000_000),
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
