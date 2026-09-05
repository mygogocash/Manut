/**
 * The OneWave ingest contract.
 *
 * These types used to live in `ow-ingest.service.ts` alongside the Google
 * Sheet parser. That parser is gone — the dashboard now syncs from the BNII
 * Analytics API, the same upstream the team used to transcribe into the sheet
 * by hand — so the shapes moved here, where they belong to the ingest contract
 * rather than to one particular producer of it.
 */
import type { OwMetricKey, OwTelco } from "@/modules/marketing/ow-aliases";

export interface OwMetricRow {
  date: string; // YYYY-MM-DD
  telco: OwTelco;
  values: Partial<Record<OwMetricKey, number>>;
  txMetrics?: Record<string, number>;
  isIntraday: boolean;
  /** Where the row came from — "analytics-api" for every live row now. */
  sourceTab: string;
}

/**
 * A per-telco grid the dashboard renders. Synthesised from the API response
 * rather than read off a spreadsheet tab, but the shape is unchanged so the
 * dashboard did not need rewriting.
 */
export interface OwRawTab {
  title: string;
  telco: OwTelco | null;
  headers: string[];
  rows: string[][];
}

export interface OwIngestResult {
  metrics: OwMetricRow[];
  rawTabs: OwRawTab[];
  telcos: OwTelco[];
  warnings: string[];
  fetchedAt: string;
}
