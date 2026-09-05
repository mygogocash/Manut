/**
 * Atlas raw-field registry — a faithful port of the Atlas Operator Console's
 * `CANONICAL_RAW_FIELDS` (atlas-prod/web/atlas-v4.1.html:461), resolved through
 * `METRIC_MAP` / `SUMMED_METRIC_MAP` / `ALIAS_METRIC_MAP` and `_FIELD_AGG`
 * (atlas-prod/app/services/bnii_ingest.py) so each row also knows which UPSTREAM
 * BNII API key feeds it and how the 30-day headline is computed.
 *
 * GENERATED from the Atlas repo — do not hand-edit. Three id spaces exist and
 * conflating them is the classic bug here:
 *   `id`       canonical catalog id — what METRIC FORMULAS reference (mau_d30)
 *   `bnii`     Atlas's own ingest/DB field — what Atlas DISPLAYS as FIELD ID (mau)
 *   `upstream` the live BNII API metric key(s) we must request (mau_ga)
 *
 * 39 entries; the explorer shows the 31 that are neither `idx` (the date column)
 * nor `hide` (fields BNII does not expose, e.g. mau_d1/d7/d60/d90/d180/d365).
 */

/** Upstream system a field originates from. */
export type AtlasFieldSource =
  | "time"
  | "ga4"
  | "binaryos"
  | "stw"
  | "bnry"
  | "bnrymart";

export const ATLAS_SOURCE_LABELS: Record<AtlasFieldSource, string> = {
  time: "Time index",
  ga4: "GA4 · BNII API",
  binaryos: "BinaryOS Events",
  stw: "STW Engine",
  bnry: "BNRY Token Ledger",
  bnrymart: "BnryMart",
};

/**
 * How a daily series collapses into the window headline. Mirrors `_FIELD_AGG`:
 * `avg` for distinct-users-per-day metrics (summing them overcounts the true
 * 30-day unique), `last` for the rolling-30 MAU (summing a rolling figure would
 * multiply it by 30), `sum` for everything else.
 */
export type AtlasFieldAgg = "sum" | "avg" | "last";

export interface AtlasRawField {
  id: string;
  label: string;
  source: AtlasFieldSource;
  /** Atlas ingest field name — also the FIELD ID shown in the table. */
  bnii: string | null;
  /** Live BNII API metric key(s). More than one means they are summed. */
  upstream: string[];
  agg: AtlasFieldAgg;
  /** Upstream reports these as negative debits; take the absolute value. */
  abs?: boolean;
  note?: string;
  /** The date column — never rendered as a data row. */
  idx?: boolean;
  /** No BNII source; kept so formulas resolve but always yields no-data. */
  hide?: boolean;
}

export const ATLAS_RAW_FIELDS: AtlasRawField[] = [
  {
    id: "date",
    label: "Date",
    source: "time",
    bnii: null,
    upstream: [],
    agg: "sum",
    idx: true,
  },
  {
    id: "unique_users",
    label: "Unique Users",
    source: "ga4",
    bnii: "unique_users",
    upstream: ["dau_ga"],
    agg: "sum",
    note: "Dau GA sum",
  },
  {
    id: "dau_ga",
    label: "Avg Daily Active Users (GA4)",
    source: "ga4",
    bnii: "dau_ga",
    upstream: ["dau_ga"],
    agg: "avg",
  },
  {
    id: "mau_d30",
    label: "Monthly Active Users (30d)",
    source: "ga4",
    bnii: "mau",
    upstream: ["mau_ga"],
    agg: "last",
  },
  {
    id: "new_users_ga",
    label: "New Users",
    source: "ga4",
    bnii: "new_users_ga",
    upstream: ["new_users_ga"],
    agg: "sum",
  },
  {
    id: "repeated_users_ga",
    label: "Repeat Users",
    source: "ga4",
    bnii: "repeated_users_ga",
    upstream: ["repeated_users_ga"],
    agg: "sum",
  },
  {
    id: "total_homepage_views",
    label: "Total Homepage Views",
    source: "ga4",
    bnii: "total_homepage_views",
    upstream: ["total_views_homepage"],
    agg: "sum",
  },
  {
    id: "avg_session_sec",
    label: "Avg Session Time (s)",
    source: "binaryos",
    bnii: "avg_time_seconds",
    upstream: ["avg_time_spent_seconds"],
    agg: "avg",
  },
  {
    id: "clicked_games_unique",
    label: "Users Clicked Games (unique)",
    source: "binaryos",
    bnii: null,
    upstream: [],
    agg: "sum",
    hide: true,
  },
  {
    id: "avg_unique_user_games",
    label: "Average Unique Users Entered Games",
    source: "binaryos",
    bnii: "users_clicked_games",
    upstream: ["total_user_games"],
    agg: "avg",
  },
  {
    id: "avg_unique_user_fando",
    label: "Average Unique Users Entered Fando",
    source: "binaryos",
    bnii: "total_user_fando",
    upstream: ["total_user_fando"],
    agg: "avg",
  },
  {
    id: "avg_unique_user_ngage",
    label: "Average Unique Users Entered Ngage",
    source: "binaryos",
    bnii: "total_user_ngage",
    upstream: ["total_user_ngage"],
    agg: "avg",
  },
  {
    id: "stw_winners",
    label: "Average Unique Users who won STW",
    source: "stw",
    bnii: "users_won_stw",
    upstream: ["tx.spin_reward.unique_users"],
    agg: "avg",
  },
  {
    id: "access_pass_buyers",
    label: "Average Unique Users who contributed towards access pass",
    source: "bnry",
    bnii: "users_use_pass",
    upstream: ["tx.use_pass.unique_users"],
    agg: "avg",
  },
  {
    id: "bnry_earned_total",
    label: "Total BNRY earned",
    source: "bnry",
    bnii: "bnry_earned",
    upstream: ["total_credit"],
    agg: "sum",
  },
  {
    id: "bnry_earned_from_video",
    label: "BNRY Earned · Video",
    source: "bnry",
    bnii: "bnry_earned_video",
    upstream: ["tx.FOLLOW_GIVEN.amount", "tx.LIKE_GIVEN.amount"],
    agg: "sum",
    note: "FOLLOW_GIVEN + LIKE_GIVEN",
  },
  {
    id: "bnry_earned_stw",
    label: "BNRY Earned · STW",
    source: "bnry",
    bnii: "bnry_earned_stw",
    upstream: ["tx.spin_reward.amount"],
    agg: "sum",
  },
  {
    id: "bnry_earned_screentime",
    label: "BNRY Earned · Screen Time",
    source: "bnry",
    bnii: "bnry_earned_screen",
    upstream: ["tx.online_reward.amount"],
    agg: "sum",
  },
  {
    id: "bnry_earned_topup",
    label: "BNRY Earned · Topup",
    source: "bnry",
    bnii: "bnry_earned_topup",
    upstream: ["tx.purchase.amount"],
    agg: "sum",
  },
  {
    id: "bnry_earned_quest",
    label: "BNRY Earned · Quest",
    source: "bnry",
    bnii: "bnry_earned_quest",
    upstream: ["tx.QUEST_REWARD.amount"],
    agg: "sum",
  },
  {
    id: "bnry_earned_membership",
    label: "BNRY Earned · Membership",
    source: "bnry",
    bnii: "bnry_earned_membership",
    upstream: ["tx.membership_reward.amount"],
    agg: "sum",
  },
  {
    id: "bnry_redeemed_total",
    label: "BNRY Redeemed (Total)",
    source: "bnry",
    bnii: "bnry_redeemed",
    upstream: ["total_debit"],
    agg: "sum",
    abs: true,
  },
  {
    id: "bnry_spent_emart",
    label: "BNRY Spent · eMart",
    source: "bnrymart",
    bnii: "bnry_spent_emart",
    upstream: ["tx.ecoupon_purchase.amount"],
    agg: "sum",
    abs: true,
  },
  {
    id: "bnry_spent_accesspass",
    label: "BNRY Redeemed · Access Pass",
    source: "bnry",
    bnii: "bnry_redeemed_pass",
    upstream: ["tx.use_pass.amount"],
    agg: "sum",
    abs: true,
  },
  {
    id: "txns_emart",
    label: "Count of BNRY transaction happened through Emart",
    source: "bnrymart",
    bnii: "emart_tx",
    upstream: ["tx.ecoupon_purchase.count"],
    agg: "sum",
  },
  {
    id: "txns_topup",
    label: "Count of BNRY transaction happened through Topup",
    source: "bnry",
    bnii: "topup_tx",
    upstream: ["tx.purchase.count"],
    agg: "sum",
  },
  {
    id: "txns_quest",
    label: "Quests Completed",
    source: "binaryos",
    bnii: "quests_completed",
    upstream: ["tx.QUEST_REWARD.count"],
    agg: "sum",
  },
  {
    id: "total_transactions",
    label: "Total Credit + Debit transactions",
    source: "bnry",
    bnii: "total_transactions",
    upstream: ["total_transactions"],
    agg: "sum",
  },
  {
    id: "stw_tx",
    label: "Count of Bnry transactions through STW",
    source: "stw",
    bnii: "stw_tx",
    upstream: ["tx.spin_reward.count"],
    agg: "sum",
  },
  {
    id: "access_pass_tx",
    label: "Count of BNRY transaction via access pass",
    source: "bnry",
    bnii: "access_pass_tx",
    upstream: ["tx.use_pass.count"],
    agg: "sum",
  },
  {
    id: "users_quests",
    label: "Average Unique Users who completed Quests",
    source: "binaryos",
    bnii: "users_quests",
    upstream: ["tx.QUEST_REWARD.unique_users"],
    agg: "avg",
  },
  {
    id: "earned_screen_tx",
    label: "Count of BNRY transaction through screen time reward",
    source: "binaryos",
    bnii: "earned_screen_tx",
    upstream: ["tx.online_reward.count"],
    agg: "sum",
  },
  {
    id: "users_earned_screen",
    label: "Average Unique Users who earned through screen time reward",
    source: "binaryos",
    bnii: "users_earned_screen",
    upstream: ["tx.online_reward.unique_users"],
    agg: "avg",
  },
  {
    id: "mau_d1",
    label: "D1 Rolling MAU",
    source: "ga4",
    bnii: null,
    upstream: [],
    agg: "sum",
    hide: true,
  },
  {
    id: "mau_d7",
    label: "D7 Rolling MAU",
    source: "ga4",
    bnii: null,
    upstream: [],
    agg: "sum",
    hide: true,
  },
  {
    id: "mau_d60",
    label: "D60 Rolling MAU",
    source: "ga4",
    bnii: null,
    upstream: [],
    agg: "sum",
    hide: true,
  },
  {
    id: "mau_d90",
    label: "D90 Rolling MAU",
    source: "ga4",
    bnii: null,
    upstream: [],
    agg: "sum",
    hide: true,
  },
  {
    id: "mau_d180",
    label: "D180 Rolling MAU",
    source: "ga4",
    bnii: null,
    upstream: [],
    agg: "sum",
    hide: true,
  },
  {
    id: "mau_d365",
    label: "D365 Rolling MAU",
    source: "ga4",
    bnii: null,
    upstream: [],
    agg: "sum",
    hide: true,
  },
];

/** The 31 rows the explorer renders (mirrors Atlas's `!f.idx && !f.hide`). */
export function shownRawFields(): AtlasRawField[] {
  return ATLAS_RAW_FIELDS.filter((f) => !f.idx && !f.hide);
}

/**
 * Every upstream BNII key the shown fields need. 31 keys — above the 30-metric
 * cap on a single `/v1/metrics/query`, so callers must chunk.
 */
export function requiredUpstreamKeys(): string[] {
  return Array.from(new Set(shownRawFields().flatMap((f) => f.upstream)));
}

/** Canonical id → field. Formula identifiers resolve through this. */
export const FIELD_BY_ID = new Map(ATLAS_RAW_FIELDS.map((f) => [f.id, f]));
