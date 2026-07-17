import { logger } from "@/common/utils/logger";
import { prisma } from "@/infrastructure/database/prisma";
import type { PerUserActivityRow } from "@/modules/admin/usage/usage.repository";

/**
 * Phase 3 of the workspace usage report.
 *
 * When `POSTHOG_PERSONAL_API_KEY` and `POSTHOG_PROJECT_ID` are both set, this
 * module pulls the activity rollup from PostHog HogQL instead of `audit_log`.
 * Personal API keys are required for read access — the public ingest key is
 * write-only.
 *
 * Failures fall back silently: the caller catches and falls through to the
 * audit_log path so the admin screen never goes dark because PostHog is
 * having a bad day.
 */

interface PostHogConfig {
  host: string;
  personalKey: string;
  projectId: string;
}

function readConfig(): PostHogConfig | null {
  const host = process.env.POSTHOG_HOST;
  const personalKey = process.env.POSTHOG_PERSONAL_API_KEY;
  const projectId = process.env.POSTHOG_PROJECT_ID;
  if (!host || !personalKey || !projectId) return null;
  return {
    host: host.replace(/\/+$/, ""),
    personalKey,
    projectId,
  };
}

export function isPostHogActivityConfigured(): boolean {
  return readConfig() !== null;
}

interface HogQLResponse {
  results?: unknown[][];
  error?: string;
}

async function runHogQL(query: string): Promise<unknown[][]> {
  const cfg = readConfig();
  if (!cfg) {
    throw new Error("PostHog HogQL not configured");
  }
  const res = await fetch(`${cfg.host}/api/projects/${cfg.projectId}/query/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.personalKey}`,
    },
    body: JSON.stringify({
      query: { kind: "HogQLQuery", query },
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HogQL HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as HogQLResponse;
  if (json.error) {
    throw new Error(`HogQL error: ${json.error}`);
  }
  return json.results ?? [];
}

export async function findPerUserActivityFromPostHog(params: {
  page: number;
  limit: number;
  search?: string;
}): Promise<{ rows: PerUserActivityRow[]; total: number } | null> {
  if (!isPostHogActivityConfigured()) return null;

  const offset = (params.page - 1) * params.limit;

  // HogQL query — distinct_id is set to the user UUID by tracking.identify().
  // FILTER counts collapse the funnel-style event names into the same three
  // resource buckets the audit_log path uses, so the UI doesn't have to care
  // about the source.
  const query = `
    SELECT
      distinct_id AS user_id,
      count()                                                              AS events_30d,
      uniqExact(toDate(timestamp))                                         AS active_days_30d,
      countIf(event LIKE 'leave_request.%')                                AS leave_events_30d,
      countIf(event LIKE 'expense.%')                                      AS expense_events_30d,
      topK(1)(event)[1]                                                    AS top_action,
      max(timestamp)                                                       AS last_active_at
    FROM events
    WHERE timestamp > now() - interval 30 day
      AND distinct_id != ''
    GROUP BY distinct_id
    ORDER BY events_30d DESC
    LIMIT ${params.limit}
    OFFSET ${offset}
  `;

  const totalQuery = `
    SELECT count(distinct distinct_id)
    FROM events
    WHERE timestamp > now() - interval 30 day
      AND distinct_id != ''
  `;

  let rows: unknown[][];
  let totalRows: unknown[][];
  try {
    [rows, totalRows] = await Promise.all([
      runHogQL(query),
      runHogQL(totalQuery),
    ]);
  } catch (err) {
    logger.warn("[posthog-activity] HogQL query failed; falling back", {
      err: err instanceof Error ? err.message : String(err),
    });
    return null;
  }

  const userIds = rows
    .map((r) => (typeof r[0] === "string" ? r[0] : null))
    .filter((id): id is string => id !== null && /^[0-9a-f-]{36}$/.test(id));

  if (userIds.length === 0) {
    return {
      rows: [],
      total: Number(totalRows[0]?.[0] ?? 0),
    };
  }

  const userRecords = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true },
  });
  const userById = new Map(userRecords.map((u) => [u.id, u]));

  const search = params.search?.trim().toLowerCase();

  const mapped: PerUserActivityRow[] = rows.flatMap((r) => {
    const userId = typeof r[0] === "string" ? r[0] : null;
    if (!userId) return [];
    const user = userById.get(userId);
    if (!user) return [];

    if (search) {
      const name = user.name.toLowerCase();
      const email = user.email.toLowerCase();
      if (!name.includes(search) && !email.includes(search)) return [];
    }

    const lastTs =
      typeof r[6] === "string"
        ? new Date(r[6])
        : r[6] instanceof Date
          ? r[6]
          : null;

    return [
      {
        userId: user.id,
        name: user.name,
        email: user.email,
        events30d: Number(r[1] ?? 0),
        activeDays30d: Number(r[2] ?? 0),
        leaveEvents30d: Number(r[3] ?? 0),
        expenseEvents30d: Number(r[4] ?? 0),
        topAction: typeof r[5] === "string" ? r[5] : null,
        lastActiveAt: lastTs,
      },
    ];
  });

  return {
    rows: mapped,
    total: Number(totalRows[0]?.[0] ?? mapped.length),
  };
}
