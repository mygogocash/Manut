import { api } from "@/lib/api-client";
import type {
  ApiPaginatedResponse,
  ApiSuccessResponse,
} from "@/types/api.type";

// Payment-term keyword; `custom` defers to the exact creditDays count.
export type PaymentTerms =
  | "cash"
  | "net7"
  | "net14"
  | "net30"
  | "net45"
  | "net60"
  | "net90"
  | "eom"
  | "custom";

export type TaxTreatment = "vat7" | "vat0" | "exempt";

export interface Vendor {
  id: string;
  entityId: string;
  entity: { id: string; name: string; code: string };
  contactType: string | null;
  contactId: string | null;
  businessType: string | null;
  businessLocation: string | null;
  name: string;
  nameTh: string | null;
  nameEn: string | null;
  addressTh: string | null;
  addressEn: string | null;
  address2: string | null;
  address3: string | null;
  // Delivery address, distinct from the tax-invoice address (addressTh/En).
  deliveryAddressTh: string | null;
  deliveryAddressEn: string | null;
  zipCode: string | null;
  taxId: string | null;
  branchCode: string | null;
  branch: string | null;
  contactName: string | null;
  email: string | null;
  mobile: string | null;
  creditDays: number | null;
  paymentTerms: PaymentTerms | null;
  defaultCurrency: string | null;
  taxTreatment: TaxTreatment | null;
  defaultRevenueAccountId: string | null;
  defaultExpenseAccountId: string | null;
  // Decimal columns arrive as strings over JSON.
  defaultWhtRate: string | number | null;
  creditLimit: string | number | null;
  phone: string | null;
  faxNumber: string | null;
  notes: string | null;
  isActive: boolean;
  mergedIntoId?: string | null;
  mergedInto?: { id: string; name: string; contactId: string | null } | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type VendorSortField =
  | "name"
  | "contactType"
  | "businessType"
  | "businessLocation"
  | "taxId"
  | "branch"
  | "contactName"
  | "phone"
  | "creditDays"
  | "entity";

export interface VendorListParams {
  page?: number;
  limit?: number;
  entityId?: string;
  contactType?: string;
  businessType?: string;
  isActive?: boolean;
  search?: string;
  sortBy?: VendorSortField;
  sortOrder?: "asc" | "desc";
}

export interface CreateVendorInput {
  entityId: string;
  contactType?: string;
  contactId?: string;
  businessType?: string;
  businessLocation?: string;
  name: string;
  nameTh?: string;
  nameEn?: string;
  addressTh?: string;
  addressEn?: string;
  address2?: string;
  address3?: string;
  deliveryAddressTh?: string;
  deliveryAddressEn?: string;
  zipCode?: string;
  taxId?: string;
  branchCode?: string;
  branch?: string;
  contactName?: string;
  email?: string;
  mobile?: string;
  creditDays?: number;
  paymentTerms?: PaymentTerms;
  defaultCurrency?: string;
  taxTreatment?: TaxTreatment;
  defaultRevenueAccountId?: string;
  defaultExpenseAccountId?: string;
  defaultWhtRate?: number;
  creditLimit?: number;
  phone?: string;
  faxNumber?: string;
  notes?: string;
  isActive?: boolean;
}

export type UpdateVendorInput = Partial<CreateVendorInput>;

// Non-blocking warning returned alongside a successful create (e.g. a close
// name match). The write still succeeded.
export interface VendorWarning {
  code: "name-similarity";
  message: string;
  matches: Array<{ id: string; name: string }>;
}

export interface VendorMutationResponse extends ApiSuccessResponse<Vendor> {
  warning?: VendorWarning;
}

export interface VendorImportRow {
  contactType?: string;
  contactId?: string;
  businessType?: string;
  businessLocation?: string;
  name: string;
  addressTh?: string;
  addressEn?: string;
  address2?: string;
  address3?: string;
  zipCode?: string;
  taxId?: string;
  branchCode?: string;
  branch?: string;
  contactName?: string;
  email?: string;
  mobile?: string;
  creditDays?: number;
  phone?: string;
  faxNumber?: string;
}

export interface BulkImportInput {
  entityId: string;
  mode: "append" | "replace";
  rows: VendorImportRow[];
}

export interface BulkImportResult {
  mode: "append" | "replace";
  entityId: string;
  removed: number;
  inserted: number;
  updated: number;
  total: number;
}

function buildQuery<T extends object>(params: T): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export async function listVendors(
  params: VendorListParams = {},
): Promise<ApiPaginatedResponse<Vendor>> {
  return api.get(`/vendors${buildQuery(params)}`);
}

export async function getVendor(
  id: string,
): Promise<ApiSuccessResponse<Vendor>> {
  return api.get(`/vendors/${id}`);
}

export async function createVendor(
  input: CreateVendorInput,
): Promise<VendorMutationResponse> {
  return api.post("/vendors", input);
}

export async function updateVendor(
  id: string,
  input: UpdateVendorInput,
): Promise<ApiSuccessResponse<Vendor>> {
  return api.put(`/vendors/${id}`, input);
}

export async function deleteVendor(id: string): Promise<void> {
  await api.delete(`/vendors/${id}`);
}

export async function restoreVendor(
  id: string,
): Promise<ApiSuccessResponse<Vendor>> {
  return api.post(`/vendors/${id}/restore`, {});
}

export async function bulkImportVendors(
  input: BulkImportInput,
): Promise<ApiSuccessResponse<BulkImportResult>> {
  return api.post("/vendors/import", input);
}
