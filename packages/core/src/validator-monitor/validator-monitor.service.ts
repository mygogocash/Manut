import type {
  AlertField,
  AlertOperator,
  CreateNodeAlertInput,
  UpdateNodeAlertInput,
  ValidatorReport,
  ValidatorReportRow,
} from "@nexora/contracts/modules/validator-monitor/validator-monitor.validation";
import { validatorReportSchema } from "@nexora/contracts/modules/validator-monitor/validator-monitor.validation";
import type { Db } from "@nexora/db";
import { HttpException, NotFoundException } from "../http-exception";
import * as repo from "./validator-monitor.repository";

const DEFAULT_REPO = "kunanon-ui/bnry-validator-monitor";
const DEFAULT_BRANCH = "main";
const DEFAULT_FILE = "report.json";
const CACHE_TTL_MS = 5 * 60 * 1000;

export type ValidatorMonitorEnv = {
  VALIDATOR_MONITOR_GITHUB_TOKEN?: string;
  VALIDATOR_MONITOR_REPO?: string;
  VALIDATOR_MONITOR_BRANCH?: string;
  VALIDATOR_MONITOR_FILE?: string;
};

interface CacheEntry { fetchedAt: number; report: ValidatorReport; }
let cache: CacheEntry | null = null;

function readConfig(env: ValidatorMonitorEnv) {
  return {
    token: env.VALIDATOR_MONITOR_GITHUB_TOKEN?.trim(),
    repo: env.VALIDATOR_MONITOR_REPO?.trim() || DEFAULT_REPO,
    branch: env.VALIDATOR_MONITOR_BRANCH?.trim() || DEFAULT_BRANCH,
    file: env.VALIDATOR_MONITOR_FILE?.trim() || DEFAULT_FILE,
  };
}

async function fetchReportFromGitHub(env: ValidatorMonitorEnv): Promise<ValidatorReport> {
  const { token, repo: ghRepo, branch, file } = readConfig(env);
  if (!token) throw new HttpException(503, "NOT_CONFIGURED", "VALIDATOR_MONITOR_GITHUB_TOKEN is not configured on the API");
  const url = `https://api.github.com/repos/${ghRepo}/contents/${encodeURIComponent(file)}?ref=${encodeURIComponent(branch)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github.v3+json", "User-Agent": "Intranet/validator-monitor" } });
  if (!res.ok) throw new HttpException(res.status === 404 ? 404 : 502, res.status === 404 ? "NOT_FOUND" : "UPSTREAM_ERROR", res.status === 404 ? "Validator monitor report not found" : `Upstream HTTP ${res.status}`);
  const payload = (await res.json()) as { content?: string; encoding?: string };
  if (!payload.content || payload.encoding !== "base64") throw new HttpException(502, "UPSTREAM_ERROR", "Unexpected GitHub response");
  const decoded = atob(payload.content.replace(/\n/g, ""));
  return validatorReportSchema.parse(JSON.parse(decoded));
}

function readMetric(row: ValidatorReportRow, field: AlertField): number {
  if (field === "balance") return row.balanceAvax;
  if (field === "burn") return row.burnAvaxPerDay;
  return row.runwayDays;
}

function compare(value: number, op: AlertOperator, threshold: number): boolean {
  if (op === "lt") return value < threshold;
  if (op === "lte") return value <= threshold;
  if (op === "gt") return value > threshold;
  if (op === "gte") return value >= threshold;
  return value === threshold;
}

export async function getLatestReport(db: Db, env: ValidatorMonitorEnv, opts: { forceRefresh?: boolean } = {}) {
  const now = Date.now();
  if (!opts.forceRefresh && cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return { ...cache.report, cachedAt: new Date(cache.fetchedAt).toISOString(), cached: true };
  }
  const report = await fetchReportFromGitHub(env);
  cache = { fetchedAt: now, report };
  void evaluateAlerts(db, report);
  return { ...report, cachedAt: new Date(now).toISOString(), cached: false };
}

export async function listAlerts(db: Db) { return repo.listAlerts(db); }
export async function createAlert(db: Db, input: CreateNodeAlertInput, actorId: string) {
  return repo.createAlert(db, { name: input.name, nodeId: input.nodeId ?? null, field: input.field, operator: input.operator, threshold: input.threshold, email: input.email, enabled: input.enabled ?? true, cooldownMinutes: input.cooldownMinutes ?? 1440, createdBy: actorId });
}
export async function updateAlert(db: Db, id: string, input: UpdateNodeAlertInput) {
  if (!(await repo.getAlert(db, id))) throw new NotFoundException("Alert not found");
  return repo.updateAlert(db, id, { ...input, threshold: input.threshold });
}
export async function deleteAlert(db: Db, id: string) {
  if (!(await repo.getAlert(db, id))) throw new NotFoundException("Alert not found");
  await repo.deleteAlert(db, id);
}
export async function evaluateAlerts(db: Db, report: ValidatorReport) {
  const alerts = await repo.listEnabledAlerts(db);
  const now = new Date();
  for (const alert of alerts) {
    if (alert.lastTriggeredAt) {
      const ageMs = now.getTime() - new Date(alert.lastTriggeredAt).getTime();
      if (ageMs < alert.cooldownMinutes * 60 * 1000) continue;
    }
    const threshold = Number(alert.threshold);
    const rows = (alert.nodeId ? report.rows.filter(r => r.nodeID === alert.nodeId) : report.rows)
      .map(r => ({ nodeID: r.nodeID, value: readMetric(r, alert.field as AlertField) }))
      .filter(r => compare(r.value, alert.operator as AlertOperator, threshold));
    if (rows.length) await repo.markTriggered(db, alert.id, now);
  }
}
