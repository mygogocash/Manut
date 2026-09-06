import {
  HttpException,
  NotFoundException,
} from "@/common/exceptions/http-exception";
import { logger } from "@/common/utils/logger";
import { sendEmail } from "@/infrastructure/email/email.service";
import { validatorMonitorRepository } from "@/modules/validator-monitor/validator-monitor.repository";
import {
  type AlertField,
  type AlertOperator,
  type CreateNodeAlertInput,
  type UpdateNodeAlertInput,
  type ValidatorReport,
  type ValidatorReportRow,
  validatorReportSchema,
} from "@/modules/validator-monitor/validator-monitor.validation";

/**
 * BnryMainnet validator monitor — proxies the `report.json` produced
 * daily by https://github.com/kunanon-ui/bnry-validator-monitor.
 *
 * The repo is private, so the frontend can't fetch the raw file
 * directly. The API holds a fine-grained PAT (read-only on this one
 * repo) and re-serves the parsed JSON, with a 5-minute in-memory
 * cache so a kanban-style tab refresh doesn't hammer the GitHub API
 * rate limit.
 */

const DEFAULT_REPO = "kunanon-ui/bnry-validator-monitor";
const DEFAULT_BRANCH = "main";
const DEFAULT_FILE = "report.json";
const CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  fetchedAt: number;
  report: ValidatorReport;
}

let cache: CacheEntry | null = null;

function readConfig() {
  // PAT scoped to read this single private repo. Required.
  const token = process.env.VALIDATOR_MONITOR_GITHUB_TOKEN?.trim();
  const repo = process.env.VALIDATOR_MONITOR_REPO?.trim() || DEFAULT_REPO;
  const branch = process.env.VALIDATOR_MONITOR_BRANCH?.trim() || DEFAULT_BRANCH;
  const file = process.env.VALIDATOR_MONITOR_FILE?.trim() || DEFAULT_FILE;
  return { token, repo, branch, file };
}

async function fetchReportFromGitHub(): Promise<ValidatorReport> {
  const { token, repo, branch, file } = readConfig();

  if (!token) {
    // 503 because the server can't fulfil the request — admin must add
    // the secret. `NOT_CONFIGURED` lets the frontend render a calm
    // "setup required" panel instead of a generic upstream error.
    throw new HttpException(
      503,
      "NOT_CONFIGURED",
      "VALIDATOR_MONITOR_GITHUB_TOKEN is not configured on the API",
    );
  }

  // GitHub Contents API returns metadata + base64 content. Using it
  // instead of raw.githubusercontent.com keeps the token in the
  // Authorization header (raw URLs require a query-string token).
  const url = `https://api.github.com/repos/${repo}/contents/${encodeURIComponent(
    file,
  )}?ref=${encodeURIComponent(branch)}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "Manut/validator-monitor",
      },
    });
  } catch (err) {
    logger.error("validator-monitor: network error fetching report", {
      message: err instanceof Error ? err.message : String(err),
    });
    throw new HttpException(
      502,
      "UPSTREAM_UNAVAILABLE",
      "Failed to reach GitHub for validator monitor report",
    );
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    logger.warn("validator-monitor: GitHub responded with non-2xx", {
      status: res.status,
      bodyPreview: body.slice(0, 200),
    });
    throw new HttpException(
      res.status === 404 ? 404 : 502,
      res.status === 404 ? "NOT_FOUND" : "UPSTREAM_ERROR",
      res.status === 404
        ? "Validator monitor report not found in the upstream repository"
        : `Validator monitor upstream returned HTTP ${res.status}`,
    );
  }

  const payload = (await res.json()) as { content?: string; encoding?: string };
  if (!payload.content || payload.encoding !== "base64") {
    throw new HttpException(
      502,
      "UPSTREAM_ERROR",
      "Unexpected response shape from GitHub contents API",
    );
  }

  const decoded = Buffer.from(payload.content, "base64").toString("utf-8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(decoded);
  } catch (err) {
    logger.error("validator-monitor: report.json is not valid JSON", {
      message: err instanceof Error ? err.message : String(err),
    });
    throw new HttpException(
      502,
      "UPSTREAM_ERROR",
      "Validator monitor report is not valid JSON",
    );
  }

  return validatorReportSchema.parse(parsed);
}

// ─── Alert evaluation ─────────────────────────────────────

/** Read a row's metric in AVAX (balance/burn) or days (runway). */
function readMetric(row: ValidatorReportRow, field: AlertField): number {
  switch (field) {
    case "balance":
      return row.balanceAvax;
    case "burn":
      return row.burnAvaxPerDay;
    case "runway":
      return row.runwayDays;
  }
}

function compare(value: number, op: AlertOperator, threshold: number): boolean {
  switch (op) {
    case "lt":
      return value < threshold;
    case "lte":
      return value <= threshold;
    case "gt":
      return value > threshold;
    case "gte":
      return value >= threshold;
    case "eq":
      return value === threshold;
  }
}

function fmtNumber(n: number, digits = 4): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

function renderAlertRowsHtml(
  rows: { nodeID: string; value: number }[],
): string {
  return rows
    .map(
      (r) =>
        `<li><code>${r.nodeID}</code> — <strong>${fmtNumber(r.value, 5)}</strong></li>`,
    )
    .join("");
}

export class ValidatorMonitorService {
  async getLatestReport(
    opts: { forceRefresh?: boolean } = {},
  ): Promise<ValidatorReport & { cachedAt: string; cached: boolean }> {
    const now = Date.now();
    if (!opts.forceRefresh && cache && now - cache.fetchedAt < CACHE_TTL_MS) {
      return {
        ...cache.report,
        cachedAt: new Date(cache.fetchedAt).toISOString(),
        cached: true,
      };
    }

    const report = await fetchReportFromGitHub();
    cache = { fetchedAt: now, report };

    // Fire-and-forget alert evaluation. Only runs on a fresh fetch
    // (cache miss) so spam stays bounded to the 5-min cache TTL; the
    // per-rule cooldown then debounces same-condition re-fires.
    void this.evaluateAlerts(report).catch((err) => {
      logger.error("validator-monitor: alert evaluation failed", {
        message: err instanceof Error ? err.message : String(err),
      });
    });

    return {
      ...report,
      cachedAt: new Date(now).toISOString(),
      cached: false,
    };
  }

  /** Exposed for tests + manual cache busts via a future admin route. */
  clearCache(): void {
    cache = null;
  }

  // ─── Alert CRUD ───────────────────────────────────────────

  async listAlerts() {
    return validatorMonitorRepository.listAlerts();
  }

  async createAlert(input: CreateNodeAlertInput, actorId: string) {
    return validatorMonitorRepository.createAlert({
      name: input.name,
      nodeId: input.nodeId ?? null,
      field: input.field,
      operator: input.operator,
      threshold: input.threshold,
      email: input.email,
      enabled: input.enabled ?? true,
      cooldownMinutes: input.cooldownMinutes ?? 1440,
      createdById: actorId,
    });
  }

  async updateAlert(id: string, input: UpdateNodeAlertInput) {
    const existing = await validatorMonitorRepository.getAlert(id);
    if (!existing) throw new NotFoundException("Alert not found");
    return validatorMonitorRepository.updateAlert(id, {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.nodeId !== undefined && { nodeId: input.nodeId }),
      ...(input.field !== undefined && { field: input.field }),
      ...(input.operator !== undefined && { operator: input.operator }),
      ...(input.threshold !== undefined && { threshold: input.threshold }),
      ...(input.email !== undefined && { email: input.email }),
      ...(input.enabled !== undefined && { enabled: input.enabled }),
      ...(input.cooldownMinutes !== undefined && {
        cooldownMinutes: input.cooldownMinutes,
      }),
    });
  }

  async deleteAlert(id: string) {
    const existing = await validatorMonitorRepository.getAlert(id);
    if (!existing) throw new NotFoundException("Alert not found");
    await validatorMonitorRepository.deleteAlert(id);
  }

  async evaluateAlerts(report: ValidatorReport): Promise<void> {
    const alerts = await validatorMonitorRepository.listEnabledAlerts();
    if (alerts.length === 0) return;
    const now = new Date();

    for (const alert of alerts) {
      // Cooldown gate: skip if fired within the rule's window.
      if (alert.lastTriggeredAt) {
        const ageMs = now.getTime() - alert.lastTriggeredAt.getTime();
        if (ageMs < alert.cooldownMinutes * 60 * 1000) continue;
      }

      const field = alert.field as AlertField;
      const operator = alert.operator as AlertOperator;
      const threshold = Number(alert.threshold);

      const targetRows = alert.nodeId
        ? report.rows.filter((r) => r.nodeID === alert.nodeId)
        : report.rows;

      const matched = targetRows
        .map((r) => ({ nodeID: r.nodeID, value: readMetric(r, field) }))
        .filter((r) => compare(r.value, operator, threshold));

      if (matched.length === 0) continue;

      try {
        await sendEmail({
          to: alert.email,
          templateId: "validator-alert",
          variables: {
            alertName: alert.name,
            field,
            operator,
            threshold,
            generatedAt: report.generatedAt,
            rowsHtml: renderAlertRowsHtml(matched),
          },
        });
        await validatorMonitorRepository.markTriggered(alert.id, now);
        logger.info("validator-monitor: alert fired", {
          alertId: alert.id,
          name: alert.name,
          matchedCount: matched.length,
        });
      } catch (err) {
        logger.error("validator-monitor: failed to send alert email", {
          alertId: alert.id,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }
}

export const validatorMonitorService = new ValidatorMonitorService();
