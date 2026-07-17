import { api } from "@/lib/api-client";
import type {
  ApiPaginatedResponse,
  ApiSuccessResponse,
} from "@/types/api.type";

// ─── Constants ──────────────────────────────────────────────────────────

export const ACTIVITY_TYPES = ["call", "email", "meeting", "note"] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  call: "Call",
  email: "Email",
  meeting: "Meeting",
  note: "Note",
};

// ─── Types ──────────────────────────────────────────────────────────────

export interface ActivityOwner {
  id: string;
  name: string;
  email: string;
}

export interface ActivityLeadRef {
  id: string;
  company: string;
}

export interface ActivityOpportunityRef {
  id: string;
  name: string;
}

export interface ActivityContactRef {
  id: string;
  firstName: string;
  lastName: string;
}

export interface ActivityAccountRef {
  id: string;
  name: string;
}

export interface CrmActivity {
  id: string;
  type: string;
  subject: string;
  body: string | null;
  occurredAt: string;
  durationMins: number | null;
  ownerId: string;
  leadId: string | null;
  opportunityId: string | null;
  contactId: string | null;
  accountId: string | null;
  createdAt: string;
  owner: ActivityOwner;
  lead: ActivityLeadRef | null;
  opportunity: ActivityOpportunityRef | null;
  contact: ActivityContactRef | null;
  account: ActivityAccountRef | null;
}

// API requires exactly one of leadId / opportunityId / contactId / accountId.
export interface CreateCrmActivityInput {
  type: ActivityType;
  subject: string;
  body?: string;
  occurredAt: string; // ISO datetime
  durationMins?: number;
  leadId?: string;
  opportunityId?: string;
  contactId?: string;
  accountId?: string;
}

// Parent ref is immutable post-create per the API. Type / subject / body /
// timing are editable.
export interface UpdateCrmActivityInput {
  type?: ActivityType;
  subject?: string;
  body?: string;
  occurredAt?: string;
  durationMins?: number;
}

export interface ListCrmActivitiesParams {
  page?: number;
  limit?: number;
  type?: ActivityType;
  leadId?: string;
  opportunityId?: string;
  contactId?: string;
  accountId?: string;
  ownerId?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────

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

// ─── Service ────────────────────────────────────────────────────────────

export async function listCrmActivities(
  params: ListCrmActivitiesParams = {},
): Promise<ApiPaginatedResponse<CrmActivity>> {
  return api.get(`/sales-revenue/activities${buildQuery(params)}`);
}

export async function getCrmActivity(
  id: string,
): Promise<ApiSuccessResponse<CrmActivity>> {
  return api.get(`/sales-revenue/activities/${id}`);
}

export async function createCrmActivity(
  input: CreateCrmActivityInput,
): Promise<ApiSuccessResponse<CrmActivity>> {
  return api.post("/sales-revenue/activities", input);
}

export async function updateCrmActivity(
  id: string,
  input: UpdateCrmActivityInput,
): Promise<ApiSuccessResponse<CrmActivity>> {
  return api.put(`/sales-revenue/activities/${id}`, input);
}

export async function deleteCrmActivity(id: string): Promise<void> {
  await api.delete(`/sales-revenue/activities/${id}`);
}
