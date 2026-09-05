import { api } from "@/lib/api-client";
import type {
  ApiPaginatedResponse,
  ApiSuccessResponse,
} from "@/types/api.type";

// ─── Types ──────────────────────────────────────────────

export interface MarketingCampaign {
  id: string;
  title: string;
  campaignDate: string;
  hours: number | null;
  leversPulled: string | null;
  copyDesign: string | null;
  predictionFileUrl: string | null;
  predictionFileName: string | null;
  status: string;
  creator: { id: string; name: string; email: string } | null;
  createdAt: string;
  updatedAt: string;
}

export const CAMPAIGN_STATUSES = [
  { value: "planned", label: "Planned" },
  { value: "live", label: "Live" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
] as const;

export interface CreateMarketingCampaignInput {
  title: string;
  campaignDate: string;
  hours?: number | null;
  leversPulled?: string | null;
  copyDesign?: string | null;
  predictionFileUrl?: string | null;
  predictionFileName?: string | null;
  status?: string;
}

export type UpdateMarketingCampaignInput =
  Partial<CreateMarketingCampaignInput>;

export interface MarketingCampaignParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}

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

export async function listMarketingCampaigns(
  params: MarketingCampaignParams = {},
): Promise<ApiPaginatedResponse<MarketingCampaign>> {
  return api.get(`/marketing/campaigns${buildQuery(params)}`);
}

export async function createMarketingCampaign(
  input: CreateMarketingCampaignInput,
): Promise<ApiSuccessResponse<MarketingCampaign>> {
  return api.post("/marketing/campaigns", input);
}

export async function updateMarketingCampaign(
  id: string,
  input: UpdateMarketingCampaignInput,
): Promise<ApiSuccessResponse<MarketingCampaign>> {
  return api.put(`/marketing/campaigns/${id}`, input);
}

export async function deleteMarketingCampaign(
  id: string,
): Promise<ApiSuccessResponse<{ success: boolean }>> {
  return api.delete(`/marketing/campaigns/${id}`);
}

export async function getCampaignPredictionUrl(
  id: string,
): Promise<ApiSuccessResponse<{ url: string; fileName: string | null }>> {
  return api.get(`/marketing/campaigns/${id}/prediction-download`);
}

// ─── OW Dashboard ───────────────────────────────────────

export interface MarketingDashboard {
  totalCampaigns: number;
  upcomingCount: number;
  liveCount: number;
  totalHours: number;
  statusBreakdown: Record<string, number>;
  monthly: Array<{ month: string; count: number }>;
  upcoming: Array<{
    id: string;
    title: string;
    campaignDate: string;
    hours: number | null;
    status: string;
    leversPulled: string | null;
  }>;
  /** Live OW2.0 traction grid; null when the sheet sync isn't configured. */
  traction: MarketingTraction | null;
}

export interface MarketingTraction {
  headers: string[];
  rows: string[][];
  range: string;
  fetchedAt: string;
}

export async function getMarketingDashboard(
  fresh = false,
): Promise<ApiSuccessResponse<MarketingDashboard>> {
  return api.get(`/marketing/dashboard${fresh ? "?fresh=1" : ""}`);
}

// ─── OW Holistic Dashboard (P1 — normalized multi-tab snapshot) ──

export interface OwRawTab {
  title: string;
  telco: string | null;
  headers: string[];
  rows: string[][];
}

export interface OwSnapshotPayload {
  generatedAt: string;
  telcos: string[];
  rawTabs: OwRawTab[];
  warnings: string[];
  metricCount: number;
}

export interface HolisticDashboard {
  /** Latest computed snapshot; null on a cold start / unconfigured sheet. */
  snapshot: OwSnapshotPayload | null;
  /** AI narrative — null until the P3 layer ships. */
  narrative: unknown | null;
  generatedAt: string | null;
  campaigns: Array<{
    id: string;
    title: string;
    campaignDate: string;
    hours: number | null;
    status: string;
    leversPulled: string | null;
    copyDesign: string | null;
    predictionFileUrl: string | null;
    predictionFileName: string | null;
  }>;
}

export async function getHolisticDashboard(
  fresh = false,
): Promise<ApiSuccessResponse<HolisticDashboard>> {
  return api.get(`/marketing/holistic-dashboard${fresh ? "?fresh=1" : ""}`);
}
