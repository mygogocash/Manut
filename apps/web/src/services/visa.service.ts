import { api } from "@/lib/api-client";
import type {
  ApiPaginatedResponse,
  ApiSuccessResponse,
} from "@/types/api.type";

// ─── Types ──────────────────────────────────────────────

export interface VisaEmployee {
  id: string;
  name: string;
  email: string;
}

export interface VisaEntity {
  id: string;
  name: string;
}

export const VISA_DOCUMENT_CATEGORIES = [
  "passport_front",
  "visa_page",
  "work_permit",
  "other",
] as const;

export type VisaDocumentCategory = (typeof VISA_DOCUMENT_CATEGORIES)[number];

export const VISA_DOCUMENT_CATEGORY_LABELS: Record<
  VisaDocumentCategory,
  string
> = {
  passport_front: "Passport Front Page",
  visa_page: "Visa Page",
  work_permit: "Work Permit",
  other: "Other",
};

export interface VisaDocument {
  name: string;
  url: string;
  type?: string;
  category: VisaDocumentCategory;
}

export const VISA_HOLDER_TYPES = ["employee", "dependent"] as const;
export type VisaHolderType = (typeof VISA_HOLDER_TYPES)[number];
export const VISA_HOLDER_TYPE_LABELS: Record<VisaHolderType, string> = {
  employee: "Employee",
  dependent: "Other (dependent / family)",
};

export interface VisaRecord {
  id: string;
  employeeId: string;
  /**
   * `employee` (default): the joined `employee` is the holder.
   * `dependent`: `employee` is the SPONSOR, `holderName` carries the
   * dependent's real name, `holderRelationship` is e.g. "spouse".
   */
  holderType: VisaHolderType;
  holderName: string | null;
  holderRelationship: string | null;
  visaType: string;
  country: string;
  nationality: string | null;
  issueDate: string | null;
  expiryDate: string;
  workPermitNumber: string | null;
  workPermitIssueDate: string | null;
  workPermitExpiryDate: string | null;
  status: string;
  documentUrl: string | null;
  documents: VisaDocument[];
  notes: string | null;
  entityId: string | null;
  employee: VisaEmployee;
  entity: VisaEntity | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVisaInput {
  employeeId: string;
  holderType?: VisaHolderType;
  holderName?: string;
  holderRelationship?: string;
  visaType: string;
  country: string;
  nationality?: string;
  issueDate?: string;
  expiryDate: string;
  workPermitNumber?: string;
  workPermitIssueDate?: string;
  workPermitExpiryDate?: string;
  status: string;
  documentUrl?: string;
  documents?: VisaDocument[];
  notes?: string;
  entityId?: string;
}

export type UpdateVisaInput = Partial<CreateVisaInput>;

export interface VisaParams {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  entityId?: string;
}

export const VISA_STATUSES = [
  "active",
  "expired",
  "pending",
  "processing",
] as const;

export const VISA_STATUS_LABELS: Record<string, string> = {
  active: "Active",
  expired: "Expired",
  pending: "Pending",
  processing: "Processing",
};

export const VISA_TYPES = [
  "work_visa",
  "residence_visa",
  "tourist_visa",
  "business_visa",
  "transit_visa",
  "other",
] as const;

export const VISA_TYPE_LABELS: Record<string, string> = {
  work_visa: "Work Visa",
  residence_visa: "Residence Visa",
  tourist_visa: "Tourist Visa",
  business_visa: "Business Visa",
  transit_visa: "Transit Visa",
  other: "Other",
};

// ─── Helpers ────────────────────────────────────────────

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

export function isExpiringSoon(expiryDate: string, days = 30): boolean {
  const expiry = new Date(expiryDate);
  const now = new Date();
  const diff = expiry.getTime() - now.getTime();
  return diff > 0 && diff <= days * 24 * 60 * 60 * 1000;
}

// ─── Service ────────────────────────────────────────────

export async function listVisas(
  params: VisaParams = {},
): Promise<ApiPaginatedResponse<VisaRecord>> {
  return api.get(`/visa${buildQuery(params)}`);
}

export async function getVisa(
  id: string,
): Promise<ApiSuccessResponse<VisaRecord>> {
  return api.get(`/visa/${id}`);
}

export async function createVisa(
  input: CreateVisaInput,
): Promise<ApiSuccessResponse<VisaRecord>> {
  return api.post("/visa", input);
}

export async function updateVisa(
  id: string,
  input: UpdateVisaInput,
): Promise<ApiSuccessResponse<VisaRecord>> {
  return api.put(`/visa/${id}`, input);
}

export async function deleteVisa(id: string): Promise<void> {
  await api.delete(`/visa/${id}`);
}

// ── Timeline ────────────────────────────────────────────────────────────

export type VisaEventKind =
  | "created"
  | "status_change"
  | "expiry_updated"
  | "issue_updated"
  | "work_permit_updated"
  | "note_added"
  | "document_added"
  | "reminder_sent";

export interface VisaEvent {
  id: string;
  visaRecordId: string;
  actorId: string | null;
  actorType: "user" | "system";
  kind: VisaEventKind | string;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
  actor: { id: string; name: string } | null;
}

export async function getVisaTimeline(
  id: string,
): Promise<ApiSuccessResponse<VisaEvent[]>> {
  return api.get(`/visa/${id}/timeline`);
}

// Mint a short-lived signed URL for a visa document. Pass `docIndex` to
// pick an entry from `documents[]`; omit it to use the legacy single
// `documentUrl` column. Bucket is private.
export async function getVisaDownloadUrl(
  id: string,
  docIndex?: number,
): Promise<ApiSuccessResponse<{ url: string; name: string }>> {
  const qs = docIndex !== undefined ? `?docIndex=${docIndex}` : "";
  return api.get(`/visa/${id}/download${qs}`);
}

// Expiry milestone buckets matching backend REMINDER_MILESTONES_DAYS.
// Order matters: closest-to-expiry first.
export const VISA_EXPIRY_BUCKETS = [
  { id: "1w", label: "Within 1 week", maxDays: 7, tone: "red" as const },
  { id: "2w", label: "Within 2 weeks", maxDays: 14, tone: "red" as const },
  { id: "1m", label: "Within 1 month", maxDays: 30, tone: "amber" as const },
  { id: "2m", label: "Within 2 months", maxDays: 60, tone: "amber" as const },
  { id: "3m", label: "Within 3 months", maxDays: 90, tone: "amber" as const },
] as const;

export type VisaExpiryBucketId = (typeof VISA_EXPIRY_BUCKETS)[number]["id"];

// Assign each record to the closest milestone bucket (1w wins over 1m).
export function bucketForDaysLeft(daysLeft: number): VisaExpiryBucketId | null {
  if (daysLeft < 0) return null;
  for (const b of VISA_EXPIRY_BUCKETS) {
    if (daysLeft <= b.maxDays) return b.id;
  }
  return null;
}

export interface VisaImportPreview {
  valid: Array<Record<string, unknown>>;
  errors: Array<{ row: number; message: string }>;
  totalRows: number;
  validCount: number;
  errorCount: number;
}

export async function previewVisaImport(
  rows: Array<Record<string, unknown>>,
): Promise<ApiSuccessResponse<VisaImportPreview>> {
  return api.post("/visa/import/preview", { rows });
}

export async function commitVisaImport(
  rows: Array<Record<string, unknown>>,
): Promise<ApiSuccessResponse<{ imported: number }>> {
  return api.post("/visa/import/commit", { rows });
}

export interface VisaNotificationConfig {
  emails: string[];
  /** Days-before-expiry buckets that fire reminders (sorted desc). */
  leadDays: number[];
  /** When false, cron skips the visa holder and only mails the HR list. */
  notifyEmployee: boolean;
}

export async function getVisaNotificationConfig(): Promise<
  ApiSuccessResponse<VisaNotificationConfig>
> {
  return api.get("/visa/notification-config");
}

export async function setVisaNotificationRecipients(
  emails: string[],
): Promise<ApiSuccessResponse<{ emails: string[] }>> {
  return api.put("/visa/notification-config/recipients", { emails });
}

export async function setVisaNotificationLeadDays(
  leadDays: number[],
): Promise<ApiSuccessResponse<{ leadDays: number[] }>> {
  return api.put("/visa/notification-config/lead-days", { leadDays });
}

export async function setVisaNotificationNotifyEmployee(
  notifyEmployee: boolean,
): Promise<ApiSuccessResponse<{ notifyEmployee: boolean }>> {
  return api.put("/visa/notification-config/notify-employee", {
    notifyEmployee,
  });
}
