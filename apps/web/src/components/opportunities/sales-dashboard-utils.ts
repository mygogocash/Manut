import type { SalesDashboardRow } from "@/services/crm-opportunity.service";

// ── Derived display stage ──────────────────────────────────────────────
// The pipeline has six stage codes (qualified / proposal / negotiation /
// closed_won / live / closed_lost). The dashboard mirrors the McKinsey
// reference's lifecycle buckets: `live` → "Live" (launched), `closed_won`
// → "Going Live" (signed, launch pending), the early stages collapse into
// "Pipeline", and `closed_lost` is its own bucket.
export type DisplayStage =
  | "Live"
  | "Going Live"
  | "Negotiation"
  | "Proposal"
  | "Qualified"
  | "Closed Lost";

export const DISPLAY_STAGES: DisplayStage[] = [
  "Live",
  "Going Live",
  "Negotiation",
  "Proposal",
  "Qualified",
  "Closed Lost",
];

// Bucket = the three KPI tiles. Pipeline = active early stages.
export type StageBucket = "live" | "going_live" | "pipeline" | "lost";

export const STAGE_COLOR: Record<DisplayStage, string> = {
  Live: "#16a34a",
  "Going Live": "#0d9488",
  Negotiation: "#d97706",
  Proposal: "#7c3aed",
  Qualified: "#2563eb",
  "Closed Lost": "#dc2626",
};

export const REGION_COLOR: Record<string, string> = {
  Asia: "#2563eb",
  Africa: "#16a34a",
  "Middle East": "#d97706",
  Europe: "#7c3aed",
  Americas: "#dc2626",
};

const INDUSTRY_PALETTE = [
  "#2563eb",
  "#7c3aed",
  "#16a34a",
  "#d97706",
  "#dc2626",
  "#0d9488",
  "#64748b",
];

export function industryColor(index: number): string {
  return INDUSTRY_PALETTE[index % INDUSTRY_PALETTE.length];
}

export function deriveStage(row: SalesDashboardRow): DisplayStage {
  const s = (row.stage || "").toLowerCase();
  if (s === "closed_lost") return "Closed Lost";
  // `live` is its own pipeline stage (launched). `closed_won` is signed but
  // not yet launched → "Going Live". Anything unknown falls to "Qualified".
  if (s === "live") return "Live";
  if (s === "closed_won") return "Going Live";
  if (s === "negotiation") return "Negotiation";
  if (s === "proposal") return "Proposal";
  return "Qualified";
}

export function stageBucket(stage: DisplayStage): StageBucket {
  if (stage === "Live") return "live";
  if (stage === "Going Live") return "going_live";
  if (stage === "Closed Lost") return "lost";
  return "pipeline";
}

// ── Formatting ─────────────────────────────────────────────────────────
export function fmtMoney(v: number): string {
  if (!v) return "$0";
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${Math.round(v / 1_000)}K`;
  return `$${v.toLocaleString()}`;
}

// totalUsers / appUsers are stored as ABSOLUTE counts on the account (the
// form takes a raw number, e.g. 12500; the account page renders it raw). Scale
// to K/M/B for the compact dashboard tiles. (Previously this assumed the value
// was already in millions and rendered 250,000 users as "250.0B".)
export function fmtUsers(v: number): string {
  if (!v) return "0";
  const abs = Math.abs(v);
  if (abs >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return `${v}`;
}

export function probColor(p: number): string {
  if (p >= 100) return "#16a34a";
  if (p >= 60) return "#d97706";
  if (p >= 40) return "#7c3aed";
  if (p >= 20) return "#2563eb";
  return "#dc2626";
}

// ── Map name matching ──────────────────────────────────────────────────
// The world-atlas TopoJSON labels features by `properties.name`. CRM
// country values mostly match; a few need an alias so the choropleth
// colours them. Compared case-insensitively.
const COUNTRY_ALIASES: Record<string, string> = {
  laos: "Laos",
  "lao pdr": "Laos",
  "south korea": "South Korea",
  "republic of korea": "South Korea",
  "united states": "United States of America",
  usa: "United States of America",
  tanzania: "Tanzania",
  "united republic of tanzania": "Tanzania",
};

export function normalizeCountryName(name: string): string {
  const key = name.trim().toLowerCase();
  return COUNTRY_ALIASES[key] ?? name.trim();
}

export function countryMatchesFeature(
  crmCountry: string,
  featureName: string,
): boolean {
  const a = normalizeCountryName(crmCountry).toLowerCase();
  const b = featureName.trim().toLowerCase();
  return a === b;
}
