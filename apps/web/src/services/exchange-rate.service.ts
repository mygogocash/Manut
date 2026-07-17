import { api } from "@/lib/api-client";
import type { ApiSuccessResponse } from "@/types/api.type";

// Workspace-admin CRUD over the
// finance.exchange_rates table. Lookup happens server-side; this client
// is only used by the admin manager dialog.

export interface ExchangeRate {
  id: string;
  baseCurrency: string;
  currency: string;
  // Numeric in DB; serialized as string by Prisma so the precision
  // survives the JSON round-trip.
  rate: number | string;
  effectiveDate: string;
  source: string | null;
  createdAt: string;
}

export interface CreateExchangeRateInput {
  baseCurrency: string;
  currency: string;
  rate: number;
  effectiveDate: string;
  source?: string;
}

export interface UpdateExchangeRateInput {
  rate?: number;
  source?: string;
}

export interface ListExchangeRatesParams {
  baseCurrency?: string;
  currency?: string;
  latestOnly?: boolean;
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

export async function listExchangeRates(
  params: ListExchangeRatesParams = {},
): Promise<ApiSuccessResponse<ExchangeRate[]>> {
  return api.get(`/exchange-rates${buildQuery(params)}`);
}

export async function createExchangeRate(
  input: CreateExchangeRateInput,
): Promise<ApiSuccessResponse<ExchangeRate>> {
  return api.post("/exchange-rates", input);
}

export async function updateExchangeRate(
  id: string,
  input: UpdateExchangeRateInput,
): Promise<ApiSuccessResponse<ExchangeRate>> {
  return api.put(`/exchange-rates/${id}`, input);
}

export async function deleteExchangeRate(id: string): Promise<void> {
  await api.delete(`/exchange-rates/${id}`);
}

export interface BotSyncResult {
  configured: boolean;
  synced: Array<{
    currency: string;
    rate: number;
    per100: boolean;
    period: string;
  }>;
  skipped: string[];
  errors: Array<{ currency: string; message: string }>;
}

/** Trigger a manual Bank of Thailand rate sync (accounting:admin). */
export async function syncExchangeRatesFromBot(): Promise<
  ApiSuccessResponse<BotSyncResult>
> {
  return api.post("/exchange-rates/sync-bot", {});
}
