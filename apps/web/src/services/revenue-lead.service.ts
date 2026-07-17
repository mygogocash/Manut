import { api } from "@/lib/api-client";
import type {
  ApiPaginatedResponse,
  ApiSuccessResponse,
} from "@/types/api.type";

// ─── Constants (mirror apps/api zod enums) ──────────────────────────────

// `LEAD_SOURCES` was a static list. Sources now
// live in the `crm_lead_sources` table; consumers should read them via
// the `useLeadSources()` hook. The labels live on the row itself.

export const LEAD_STATUSES = [
  "new",
  "contacted",
  "qualified",
  "converted",
  "disqualified",
] as const;

export const LEAD_STATUS_LABELS: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  converted: "Converted",
  disqualified: "Disqualified",
};

// ─── Types ──────────────────────────────────────────────────────────────

export interface LeadOwner {
  id: string;
  name: string;
  email: string;
}

export interface LeadConvertedOpportunity {
  id: string;
  name: string;
  stage: string;
}

export interface Lead {
  id: string;
  company: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  source: string;
  status: string;
  ownerId: string;
  notes: string | null;
  convertedOpportunityId: string | null;
  convertedAt: string | null;
  disqualifyReason: string | null;
  legacyDealId: string | null;
  createdAt: string;
  updatedAt: string;
  owner: LeadOwner;
  convertedOpportunity: LeadConvertedOpportunity | null;
}

export interface CreateLeadInput {
  company: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  title?: string;
  // Source code resolves against the lead_sources table — server-side
  // zod enforces shape, runtime service-layer checks the value is active.
  source: string;
  status?: "new" | "contacted" | "qualified";
  notes?: string;
}

export type UpdateLeadInput = Partial<CreateLeadInput>;

export interface ListLeadsParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  source?: string;
  ownerId?: string;
}

export interface ListStaleLeadsParams {
  page?: number;
  limit?: number;
  search?: string;
  ownerId?: string;
}

// `/leads/stale` returns the standard paginated body plus the
// threshold-days the server filtered with so the UI can label the view
// without hard-coding the number.
export interface StaleLeadsResponse extends ApiPaginatedResponse<Lead> {
  thresholdDays: number;
}

export interface DisqualifyLeadInput {
  reason: string;
}

export interface ConvertLeadInput {
  accountId?: string;
  newAccount?: {
    name: string;
    domain?: string;
    industry?: string;
    size?: string;
    country?: string;
    website?: string;
  };
  contactId?: string;
  newContact?: {
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    title?: string;
  };
  opportunity: {
    name: string;
    stage?: string;
    value: number;
    currency?: string;
    probability?: number;
    closeDate?: string;
    type?: string;
  };
  ownerId?: string;
  confirmCreate?: boolean;
}

export interface ConvertLeadResult {
  lead: Lead;
  accountId: string;
  contactId: string;
  opportunity: { id: string; name: string; stage: string };
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

export async function listLeads(
  params: ListLeadsParams = {},
): Promise<ApiPaginatedResponse<Lead>> {
  return api.get(`/sales-revenue/leads${buildQuery(params)}`);
}

export async function listStaleLeads(
  params: ListStaleLeadsParams = {},
): Promise<StaleLeadsResponse> {
  return api.get(`/sales-revenue/leads/stale${buildQuery(params)}`);
}

export async function getLead(id: string): Promise<ApiSuccessResponse<Lead>> {
  return api.get(`/sales-revenue/leads/${id}`);
}

export async function createLead(
  input: CreateLeadInput,
): Promise<ApiSuccessResponse<Lead>> {
  return api.post("/sales-revenue/leads", input);
}

export async function updateLead(
  id: string,
  input: UpdateLeadInput,
): Promise<ApiSuccessResponse<Lead>> {
  return api.put(`/sales-revenue/leads/${id}`, input);
}

export async function disqualifyLead(
  id: string,
  input: DisqualifyLeadInput,
): Promise<ApiSuccessResponse<Lead>> {
  return api.post(`/sales-revenue/leads/${id}/disqualify`, input);
}

export async function convertLead(
  id: string,
  input: ConvertLeadInput,
): Promise<ApiSuccessResponse<ConvertLeadResult>> {
  return api.post(`/sales-revenue/leads/${id}/convert`, input);
}

export async function deleteLead(id: string): Promise<void> {
  await api.delete(`/sales-revenue/leads/${id}`);
}
