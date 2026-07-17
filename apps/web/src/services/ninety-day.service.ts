import { api } from "@/lib/api-client";
import type {
  ApiPaginatedResponse,
  ApiSuccessResponse,
} from "@/types/api.type";

export const NINETY_DAY_STATUSES = [
  "pending",
  "to_be_notifying",
  "approved",
  "no_required",
] as const;

export type NinetyDayStatus = (typeof NINETY_DAY_STATUSES)[number];

export const NINETY_DAY_STATUS_LABELS: Record<NinetyDayStatus, string> = {
  pending: "Pending",
  to_be_notifying: "To Be Notifying",
  approved: "Approved",
  no_required: "Not required",
};

export interface NinetyDayEmployee {
  id: string;
  name: string;
  email: string;
  department: string | null;
}

export interface NinetyDayEntity {
  id: string;
  name: string;
  code: string;
}

export type NinetyDayHolderType = "employee" | "dependent";

export interface NinetyDayReceipt {
  name: string;
  url: string;
  mimeType?: string | null;
}

export interface NinetyDayNotification {
  id: string;
  employeeId: string;
  entityId: string | null;
  entity: NinetyDayEntity | null;
  holderType: NinetyDayHolderType;
  holderName: string | null;
  holderRelationship: string | null;
  lastArrivalDate: string;
  dueDate: string;
  notification21Date: string;
  notification15Date: string;
  finalReportDate: string;
  status: NinetyDayStatus;
  notes: string | null;
  receipt: NinetyDayReceipt | null;
  lastReminderMilestoneDays: number | null;
  lastReminderSentAt: string | null;
  employee: NinetyDayEmployee;
  createdAt: string;
  updatedAt: string;
}

export interface CreateNinetyDayInput {
  employeeId: string;
  entityId?: string;
  holderType?: NinetyDayHolderType;
  holderName?: string;
  holderRelationship?: string;
  lastArrivalDate: string;
  status?: NinetyDayStatus;
  notes?: string;
  receipt?: NinetyDayReceipt | null;
}

export interface UpdateNinetyDayInput {
  entityId?: string | null;
  holderType?: NinetyDayHolderType;
  holderName?: string | null;
  holderRelationship?: string | null;
  lastArrivalDate?: string;
  status?: NinetyDayStatus;
  notes?: string;
  receipt?: NinetyDayReceipt | null;
}

export interface NinetyDayParams {
  page?: number;
  limit?: number;
  status?: NinetyDayStatus;
  search?: string;
  entityId?: string;
}

function buildQuery<T extends object>(params: T): string {
  const qs = new URLSearchParams();
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== null && val !== "") {
      qs.set(key, String(val));
    }
  }
  const str = qs.toString();
  return str ? `?${str}` : "";
}

const BASE = "/ninety-day-notifications";

export async function listNinetyDayNotifications(
  params: NinetyDayParams = {},
): Promise<ApiPaginatedResponse<NinetyDayNotification>> {
  return api.get(`${BASE}${buildQuery(params)}`);
}

export async function createNinetyDayNotification(
  input: CreateNinetyDayInput,
): Promise<ApiSuccessResponse<NinetyDayNotification>> {
  return api.post(BASE, input);
}

export async function updateNinetyDayNotification(
  id: string,
  input: UpdateNinetyDayInput,
): Promise<ApiSuccessResponse<NinetyDayNotification>> {
  return api.put(`${BASE}/${id}`, input);
}

export async function deleteNinetyDayNotification(
  id: string,
): Promise<ApiSuccessResponse<{ success: boolean }>> {
  return api.delete(`${BASE}/${id}`);
}

export async function getNinetyDayReceiptDownloadUrl(
  id: string,
): Promise<ApiSuccessResponse<{ url: string; name: string }>> {
  return api.get(`${BASE}/${id}/receipt/download`);
}

export interface NinetyDayImportPreview {
  valid: Array<Record<string, unknown>>;
  errors: Array<{ row: number; message: string }>;
  totalRows: number;
  validCount: number;
  errorCount: number;
}

export async function previewNinetyDayImport(
  rows: Array<Record<string, unknown>>,
): Promise<ApiSuccessResponse<NinetyDayImportPreview>> {
  return api.post(`${BASE}/import/preview`, { rows });
}

export async function commitNinetyDayImport(
  rows: Array<Record<string, unknown>>,
): Promise<ApiSuccessResponse<{ imported: number }>> {
  return api.post(`${BASE}/import/commit`, { rows });
}
