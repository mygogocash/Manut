import { api } from "@/lib/api-client";
import type {
  ApiPaginatedResponse,
  ApiSuccessResponse,
} from "@/types/api.type";

export interface VoucherEntry {
  id: string;
  partner: string;
  country: string | null;
  redeemed: number;
  issued: number;
  refund: number;
  sortOrder: number;
  addedBy: string | null;
  createdAt: string;
  updatedAt: string;
  creator: { id: string; name: string; email: string } | null;
}

export interface VoucherTotals {
  redeemed: number;
  issued: number;
  refund: number;
}

export interface CreateVoucherEntryInput {
  partner: string;
  country?: string | null;
  redeemed?: number;
  issued?: number;
  refund?: number;
}

export type UpdateVoucherEntryInput = Partial<CreateVoucherEntryInput>;

export interface VoucherListParams {
  page?: number;
  limit?: number;
  search?: string;
  country?: string;
}

/** List response carries the server-computed grand totals alongside the page. */
export type VoucherListResponse = ApiPaginatedResponse<VoucherEntry> & {
  totals: VoucherTotals;
};

export async function listVoucherEntries(
  params: VoucherListParams = {},
): Promise<VoucherListResponse> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  }
  const tail = qs.toString() ? `?${qs.toString()}` : "";
  return api.get(`/voucher-crm${tail}`);
}

export async function createVoucherEntry(
  input: CreateVoucherEntryInput,
): Promise<ApiSuccessResponse<VoucherEntry>> {
  return api.post("/voucher-crm", input);
}

export async function updateVoucherEntry(
  id: string,
  input: UpdateVoucherEntryInput,
): Promise<ApiSuccessResponse<VoucherEntry>> {
  return api.put(`/voucher-crm/${id}`, input);
}

export async function deleteVoucherEntry(
  id: string,
): Promise<ApiSuccessResponse<{ success: true }>> {
  return api.delete(`/voucher-crm/${id}`);
}

export async function reorderVoucherEntries(
  orderedIds: string[],
): Promise<ApiSuccessResponse<{ success: true }>> {
  return api.put("/voucher-crm/reorder", { orderedIds });
}

export async function importVoucherEntries(
  rows: CreateVoucherEntryInput[],
): Promise<ApiSuccessResponse<{ created: number }>> {
  return api.post("/voucher-crm/import", { rows });
}
