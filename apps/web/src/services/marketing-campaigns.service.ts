import { api } from "@/lib/api-client";
import type { ApiSuccessResponse } from "@/types/api.type";

export const CAMPAIGN_STATUSES = [
  "planned",
  "scheduled",
  "live",
  "completed",
  "cancelled",
] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  planned: "Planned",
  scheduled: "Scheduled",
  live: "Live",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const CREATIVE_KINDS = ["image", "video", "pdf", "link"] as const;
export type CreativeKind = (typeof CREATIVE_KINDS)[number];
export const CREATIVE_SOURCES = [
  "upload",
  "drive",
  "canva",
  "figma",
  "other",
] as const;
export type CreativeSource = (typeof CREATIVE_SOURCES)[number];
export const PREDICTION_FORMATS = ["xlsx", "csv"] as const;
export type PredictionFormat = (typeof PREDICTION_FORMATS)[number];

interface UserRef {
  id: string;
  name: string;
  email: string;
}
export interface Lever {
  id: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
}
export interface CampaignLever {
  id: string;
  name: string;
}
export interface Creative {
  id: string;
  version: number;
  kind: CreativeKind;
  source: CreativeSource;
  name: string;
  url: string;
  mimeType: string | null;
  size: number | null;
  uploadedBy: UserRef;
  createdAt: string;
}
export interface Prediction {
  id: string;
  format: PredictionFormat;
  name: string;
  url: string;
  mimeType: string | null;
  size: number | null;
  uploadedBy: UserRef;
  createdAt: string;
}

export interface CampaignListItem {
  id: string;
  name: string;
  campaignDate: string;
  hours: number | null;
  status: CampaignStatus;
  country: string | null;
  partnerId: string | null;
  product: string | null;
  channel: string | null;
  campaignType: string | null;
  owner: UserRef | null;
  budget: number | null;
  currency: string;
  expectedReach: number | null;
  actualReach: number | null;
  levers: CampaignLever[];
  creativeCount: number;
  predictionCount: number;
  archivedAt: string | null;
  createdAt: string;
}

export interface CampaignDetail extends CampaignListItem {
  ownerId: string | null;
  objective: string | null;
  targetAudience: string | null;
  leversSequence: string | null;
  copyText: string | null;
  notes: string | null;
  createdBy: UserRef;
  creatives: Creative[];
  predictions: Prediction[];
  updatedAt: string;
}

export interface CampaignInput {
  name: string;
  campaignDate: string;
  hours?: number | null;
  ownerId?: string | null;
  status?: CampaignStatus;
  country?: string | null;
  partnerId?: string | null;
  product?: string | null;
  channel?: string | null;
  campaignType?: string | null;
  objective?: string | null;
  targetAudience?: string | null;
  leversSequence?: string | null;
  copyText?: string | null;
  expectedReach?: number | null;
  actualReach?: number | null;
  budget?: number | null;
  currency?: string;
  notes?: string | null;
  leverIds?: string[];
}

export interface CampaignPage {
  data: CampaignListItem[];
  meta: { page: number; limit: number; total: number };
}

function qs(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

// ── Campaigns ──
export function listCampaigns(query: {
  page?: number;
  limit?: number;
  search?: string;
  status?: CampaignStatus;
  ownerId?: string;
  from?: string;
  to?: string;
  // When true, return ONLY archived campaigns; omit/false shows active only.
  archived?: boolean;
}): Promise<CampaignPage> {
  const { archived, ...rest } = query;
  return api.get(
    `/marketing-campaigns${qs({
      ...rest,
      archived: archived ? "true" : undefined,
    })}`,
  );
}
export function getCampaign(id: string) {
  return api.get<ApiSuccessResponse<CampaignDetail>>(
    `/marketing-campaigns/${id}`,
  );
}
export function createCampaign(input: CampaignInput) {
  return api.post<ApiSuccessResponse<CampaignDetail>>(
    "/marketing-campaigns",
    input,
  );
}
export function updateCampaign(id: string, input: Partial<CampaignInput>) {
  return api.patch<ApiSuccessResponse<CampaignDetail>>(
    `/marketing-campaigns/${id}`,
    input,
  );
}
export function deleteCampaign(id: string) {
  return api.delete<ApiSuccessResponse<{ id: string }>>(
    `/marketing-campaigns/${id}`,
  );
}
export function archiveCampaign(id: string) {
  return api.post<ApiSuccessResponse<CampaignDetail>>(
    `/marketing-campaigns/${id}/archive`,
    {},
  );
}
export function unarchiveCampaign(id: string) {
  return api.post<ApiSuccessResponse<CampaignDetail>>(
    `/marketing-campaigns/${id}/unarchive`,
    {},
  );
}

// ── Levers (admin-configurable) ──
export function listLevers(activeOnly = false) {
  return api.get<ApiSuccessResponse<Lever[]>>(
    `/marketing-campaigns/levers${qs({ active: activeOnly ? "true" : undefined })}`,
  );
}
export function createLever(input: {
  name: string;
  isActive?: boolean;
  sortOrder?: number;
}) {
  return api.post<ApiSuccessResponse<Lever>>(
    "/marketing-campaigns/levers",
    input,
  );
}
export function updateLever(
  id: string,
  input: Partial<{ name: string; isActive: boolean; sortOrder: number }>,
) {
  return api.patch<ApiSuccessResponse<Lever>>(
    `/marketing-campaigns/levers/${id}`,
    input,
  );
}
export function deleteLever(id: string) {
  return api.delete<ApiSuccessResponse<{ id: string }>>(
    `/marketing-campaigns/levers/${id}`,
  );
}

// ── Creatives (versioned) ──
export function addCreative(
  campaignId: string,
  input: {
    kind: CreativeKind;
    source: CreativeSource;
    name: string;
    url: string;
    mimeType?: string | null;
    size?: number | null;
  },
) {
  return api.post<ApiSuccessResponse<Creative>>(
    `/marketing-campaigns/${campaignId}/creatives`,
    input,
  );
}
export function deleteCreative(id: string) {
  return api.delete<ApiSuccessResponse<{ id: string }>>(
    `/marketing-campaigns/creatives/${id}`,
  );
}

// ── Predictions (history) ──
export function addPrediction(
  campaignId: string,
  input: {
    format: PredictionFormat;
    name: string;
    url: string;
    mimeType?: string | null;
    size?: number | null;
  },
) {
  return api.post<ApiSuccessResponse<Prediction>>(
    `/marketing-campaigns/${campaignId}/predictions`,
    input,
  );
}
export function deletePrediction(id: string) {
  return api.delete<ApiSuccessResponse<{ id: string }>>(
    `/marketing-campaigns/predictions/${id}`,
  );
}
