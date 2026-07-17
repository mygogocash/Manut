import { api } from "@/lib/api-client";
import type {
  ApiPaginatedResponse,
  ApiSuccessResponse,
} from "@/types/api.type";

// ─── Types ──────────────────────────────────────────────

export interface PartnerContact {
  id: string;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
}

export const PARTNER_DEPARTMENT_OPTIONS = [
  "Management",
  "Business Team",
  "Marketing",
  "Product",
  "Project",
  "IT",
  "HR",
  "Accounting",
  "Finance",
  "Finance & Accounting",
  "Legal",
  "Digital Social",
  "Operations",
  "Other",
] as const;

export type PartnerDepartment = (typeof PARTNER_DEPARTMENT_OPTIONS)[number];

export interface PartnerOwner {
  id: string;
  name: string;
  email: string;
}

export interface Partner {
  id: string;
  slug: string;
  company: string;
  type: string;
  status: string;
  // `primaryProjectId` was dropped once Partner
  // CRM owns its native workspace via the `/partners/:id/board`
  // endpoint now.
  region: string | null;
  country: string | null;
  website: string | null;
  description: string | null;
  contractValue: number | null;
  contractStart: string | null;
  contractEnd: string | null;
  notes: string | null;
  // Projects-style tracking columns (#534).
  productionLiveDate: string | null;
  goLiveDate: string | null;
  revisedGoLiveDate: string | null;
  pastCampaignDate: string | null;
  nextCampaignDate: string | null;
  dependency: string | null;
  comment: string | null;
  department: PartnerDepartment | null;
  ownerId: string | null;
  owner: PartnerOwner | null;
  sortOrder: number;
  contacts: PartnerContact[];
  _count: { projects: number; deals: number };
  createdAt: string;
}

export interface CreatePartnerInput {
  company: string;
  type: string;
  status?: string;
  region?: string;
  country?: string;
  website?: string;
  description?: string;
  contractValue?: number;
  contractStart?: string;
  contractEnd?: string;
  notes?: string;
  productionLiveDate?: string | null;
  goLiveDate?: string | null;
  revisedGoLiveDate?: string | null;
  pastCampaignDate?: string | null;
  nextCampaignDate?: string | null;
  dependency?: string | null;
  comment?: string | null;
  department?: PartnerDepartment | null;
  ownerId?: string | null;
  contacts?: Array<{
    name: string;
    title?: string;
    email?: string;
    phone?: string;
    isPrimary?: boolean;
  }>;
}

export type UpdatePartnerInput = Partial<CreatePartnerInput>;

export interface PartnerParams {
  page?: number;
  limit?: number;
  type?: string;
  status?: string;
  department?: PartnerDepartment;
  search?: string;
}

export const PARTNER_TYPES = [
  "technology",
  "consulting",
  "financial",
  "media",
  "government",
  "other",
] as const;

export const PARTNER_STATUSES = [
  "prospect",
  "active",
  "inactive",
  "churned",
] as const;

export const PARTNER_TYPE_LABELS: Record<string, string> = {
  technology: "Technology",
  consulting: "Consulting",
  financial: "Financial",
  media: "Media",
  government: "Government",
  other: "Other",
};

export const PARTNER_STATUS_LABELS: Record<string, string> = {
  prospect: "Prospect",
  active: "Active",
  inactive: "Inactive",
  churned: "Churned",
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

// ─── Service ────────────────────────────────────────────

export async function listPartners(
  params: PartnerParams = {},
): Promise<ApiPaginatedResponse<Partner>> {
  return api.get(`/partners${buildQuery(params)}`);
}

export async function getPartner(
  id: string,
): Promise<ApiSuccessResponse<Partner>> {
  return api.get(`/partners/${id}`);
}

export async function createPartner(
  input: CreatePartnerInput,
): Promise<ApiSuccessResponse<Partner>> {
  return api.post("/partners", input);
}

export async function updatePartner(
  id: string,
  input: UpdatePartnerInput,
): Promise<ApiSuccessResponse<Partner>> {
  return api.put(`/partners/${id}`, input);
}

export async function deletePartner(id: string): Promise<void> {
  await api.delete(`/partners/${id}`);
}

// Drag-to-reorder. Server assigns sortOrder = index for each id;
// unknown ids are silently dropped (matches Projects reorder).
export async function reorderPartners(
  ids: string[],
): Promise<ApiSuccessResponse<Array<{ id: string; sortOrder: number }>>> {
  return api.post("/partners/reorder", { ids });
}

export async function importPartners(
  rows: CreatePartnerInput[],
): Promise<ApiSuccessResponse<{ created: number }>> {
  return api.post("/partners/import", { rows });
}

// ─── Task export / import ───────────────────────────────

export interface PartnerTaskExportRow {
  partner: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  owner: string;
  startDate: string;
  endDate: string;
  parentTitle: string;
}

export interface ImportPartnerTaskRow {
  partner: string;
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  startDate?: string;
  endDate?: string;
  parentTitle?: string;
}

export async function exportPartnerTasks(
  params: PartnerParams = {},
): Promise<ApiSuccessResponse<PartnerTaskExportRow[]>> {
  return api.get(`/partners/tasks/export${buildQuery(params)}`);
}

export async function importPartnerTasks(
  rows: ImportPartnerTaskRow[],
): Promise<ApiSuccessResponse<{ created: number; skipped: number }>> {
  return api.post("/partners/tasks/import", { rows });
}

// `ensurePartnerWorkspace` was removed in Phase 4a of the Partner ↔
// Partner CRM now owns its native
// `partner_*` workspace; the legacy redirect-shim is gone.
