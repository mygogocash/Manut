import type { Db } from "@nexora/db";
import { HttpException } from "../http-exception.js";
import { getSetting, upsertSetting } from "../lib/system-settings.js";

export const DRIFT_RECIPIENTS_KEY = "marketing-analytics.drift_recipients";

export type MarketingAnalyticsEnv = {
  MARKETING_ANALYTICS_ENABLED?: string;
};

export function isMarketingAnalyticsEnabled(env: MarketingAnalyticsEnv = {}) {
  return env.MARKETING_ANALYTICS_ENABLED === "true";
}

function externalUnavailable() {
  throw new HttpException(
    503,
    "SERVICE_UNAVAILABLE",
    "Marketing analytics upstream is not available on edge yet",
  );
}

export async function getDriftRecipients(db: Db): Promise<string[]> {
  const raw = await getSetting(db, DRIFT_RECIPIENTS_KEY);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const recipients = (raw as { recipients?: unknown }).recipients;
  return Array.isArray(recipients)
    ? recipients.filter((r): r is string => typeof r === "string" && r.includes("@"))
    : [];
}

export async function setDriftRecipients(db: Db, recipients: string[]) {
  const clean = recipients.map((r) => r.trim().toLowerCase()).filter((r) => r.includes("@"));
  await upsertSetting(db, DRIFT_RECIPIENTS_KEY, { recipients: clean });
  return { recipients: clean };
}

export function assertEnabled(env: MarketingAnalyticsEnv) {
  if (!isMarketingAnalyticsEnabled(env)) {
    throw new HttpException(503, "FEATURE_DISABLED", "Marketing analytics is disabled");
  }
}

export async function dashboard(_db: Db, env: MarketingAnalyticsEnv) {
  assertEnabled(env);
  externalUnavailable();
}

export async function getCatalog(_db: Db, env: MarketingAnalyticsEnv) {
  assertEnabled(env);
  externalUnavailable();
}

export async function refresh(_db: Db, env: MarketingAnalyticsEnv) {
  assertEnabled(env);
  externalUnavailable();
}

export async function dauMauDashboard(_db: Db, _query: unknown, env: MarketingAnalyticsEnv) {
  assertEnabled(env);
  externalUnavailable();
}

export async function listPartners(_db: Db, env: MarketingAnalyticsEnv) {
  assertEnabled(env);
  externalUnavailable();
}

export async function queryMetrics(_db: Db, _body: unknown, env: MarketingAnalyticsEnv) {
  assertEnabled(env);
  externalUnavailable();
}

export async function rawFields(_db: Db, _query: unknown, env: MarketingAnalyticsEnv) {
  assertEnabled(env);
  externalUnavailable();
}

export async function partnerMetrics(_db: Db, _query: unknown, env: MarketingAnalyticsEnv) {
  assertEnabled(env);
  externalUnavailable();
}

export async function hostBaseline(_db: Db, _body: unknown, env: MarketingAnalyticsEnv) {
  assertEnabled(env);
  externalUnavailable();
}

export async function overviewContent(_db: Db, _body: unknown, env: MarketingAnalyticsEnv) {
  assertEnabled(env);
  externalUnavailable();
}

export async function getOverviewContent(db: Db, env: MarketingAnalyticsEnv) {
  assertEnabled(env);
  const raw = await getSetting(db, "marketing-analytics.overview_content");
  return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
}

export async function setOverviewContent(db: Db, body: unknown, env: MarketingAnalyticsEnv) {
  assertEnabled(env);
  await upsertSetting(db, "marketing-analytics.overview_content", body);
  return body;
}

export async function setPartnerHostBaseline(_slug: string, _body: unknown, env: MarketingAnalyticsEnv) {
  assertEnabled(env);
  externalUnavailable();
}

export async function clearPartnerHostBaseline(_slug: string, env: MarketingAnalyticsEnv) {
  assertEnabled(env);
  externalUnavailable();
}

export async function listMetrics(_db: Db, _query: unknown, env: MarketingAnalyticsEnv) {
  assertEnabled(env);
  externalUnavailable();
}
