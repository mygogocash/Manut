import { api } from "@/lib/api-client";
import type {
  ApiPaginatedResponse,
  ApiPagination,
  ApiSuccessResponse,
} from "@/types/api.type";

export type ActivitySource = "audit_log" | "posthog";

export interface ActivityListResponse {
  data: PerUserActivity[];
  meta: ApiPagination & { source: ActivitySource };
}

export interface WorkspaceUsageTotals {
  totalUsers: number;
  activeUsers: number;
  storageBytes: number;
  fileCount: number;
  filesAdded30d: number;
}

export interface PerUserStorage {
  userId: string;
  name: string;
  email: string;
  totalBytes: number;
  fileCount: number;
  breakdown: {
    generalBytes: number;
    hrBytes: number;
    dataroomBytes: number;
  };
  lastUploadAt: string | null;
}

export interface PerUserActivity {
  userId: string;
  name: string;
  email: string;
  events30d: number;
  activeDays30d: number;
  breakdown: {
    leaveEvents30d: number;
    expenseEvents30d: number;
  };
  topAction: string | null;
  lastActiveAt: string | null;
}

export interface ListStorageParams {
  page?: number;
  limit?: number;
  search?: string;
}

export type ListActivityParams = ListStorageParams;

export interface BucketSnapshot {
  bucket: string;
  bytes: number;
  objectCount: number;
  capturedAt: string;
}

export interface BucketHealth {
  buckets: BucketSnapshot[];
  bucketTotalBytes: number;
  trackedBytes: number;
  unaccountedBytes: number;
  capturedAt: string | null;
}

function buildQuery(params: ListStorageParams): string {
  const qs = new URLSearchParams();
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== null && val !== "") {
      qs.set(key, String(val));
    }
  }
  const str = qs.toString();
  return str ? `?${str}` : "";
}

export async function getUsageTotals(): Promise<
  ApiSuccessResponse<WorkspaceUsageTotals>
> {
  return api.get("/admin/usage/totals");
}

export async function listUserStorage(
  params: ListStorageParams = {},
): Promise<ApiPaginatedResponse<PerUserStorage>> {
  return api.get(`/admin/usage/storage${buildQuery(params)}`);
}

export async function listUserActivity(
  params: ListActivityParams = {},
): Promise<ActivityListResponse> {
  return api.get(`/admin/usage/activity${buildQuery(params)}`);
}

export async function getBucketHealth(): Promise<
  ApiSuccessResponse<BucketHealth>
> {
  return api.get("/admin/usage/buckets");
}
