// OneWave telco + metric vocabulary.
//
// This file used to also carry the spreadsheet's header-alias table and tab
// classifier. Those existed only to reconcile the ~30 inconsistently-spelled
// tabs of the OW2.0 traction sheet; the dashboard now syncs from the BNII
// Analytics API — the same upstream the team read when filling that sheet in
// by hand — so the aliases went with the parser.

/**
 * Canonical telcos, one per live BNII partner.
 *
 * `ryze` IS Banglalink: the sheet called it Ryze and Atlas renders it
 * "Ryze-Banglalink". The slug stays `ryze` because existing
 * `ow_daily_metrics` rows are keyed by it — renaming would orphan that
 * history. UUIDs and display names live in `bnii-partners.ts`.
 */
export const OW_TELCOS = [
  "gopay",
  "dialog",
  "ryze",
  "telkomsel",
  "okara",
  "myim3",
  "bima",
  "u9",
  "robi",
] as const;
export type OwTelco = (typeof OW_TELCOS)[number] | "all";

// Canonical metric keys — mirror the numeric columns on OwDailyMetric.
export type OwMetricKey =
  | "homepageViews"
  | "dauCrm"
  | "dauGa"
  | "mauRolling30"
  | "uniqueUsers"
  | "newUsers"
  | "repeatUsers"
  | "avgSessionSec"
  | "stwWins"
  | "clicksBnryGames"
  | "accessPassUsers"
  | "bnryEarned"
  | "bnryRedeemed"
  | "mauNexus"
  | "newUsersGa"
  | "repeatUsersGa"
  | "sessionsGa"
  | "totalCredit"
  | "totalDebit"
  | "totalTransactions"
  | "spinUsage"
  | "spinWinTokens"
  | "uniqueSpinUsers"
  | "usersFando"
  | "usersNgage";

// Metric keys whose values are durations (seconds) rather than plain counts.
export const DURATION_METRICS = new Set<OwMetricKey>(["avgSessionSec"]);
