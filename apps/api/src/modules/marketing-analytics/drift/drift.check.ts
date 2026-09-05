// Pure comparison logic for the DAU/MAU drift check. No I/O — every input is
// passed in, so the whole decision surface is unit tested.
//
// Why this exists: two surfaces read the same upstream by different paths.
// `/marketing-analytics/dau-mau` queries BNII live on each request and persists
// nothing; the OneWave dashboard and Partner Workspaces read `ow_daily_metrics`,
// written by the `ow-snapshot-refresh` cron. Nothing has ever compared them, so
// a missed cron run, a partially-ingested chunk or an upstream restatement of
// history can leave the two pages quietly disagreeing about the same day.
import { createHash } from "node:crypto";

import { API_CORE_TO_KEY } from "@/modules/marketing/ow-analytics-map";
import { addDays } from "@/modules/marketing-analytics/dau-mau.metrics";
import type {
  CrossFootFinding,
  DriftWindow,
  StoreDriftFinding,
} from "@/modules/marketing-analytics/drift/drift.types";

/** Trailing settled days compared on each run. */
export const DRIFT_WINDOW_DAYS = 30;
/**
 * Days at the tail treated as still moving, so a partial day never reads as
 * drift. Today is obviously incomplete; yesterday can still be re-stated by
 * upstream and re-ingested, and `ow_daily_metrics.is_intraday` marks rows the
 * ingest wrote mid-day.
 */
export const DRIFT_UNSETTLED_DAYS = 2;

export interface DriftMetric {
  /** BNII metric key, as requested from `/v1/metrics/query`. */
  upstream: string;
  /** `ow_daily_metrics` column it is persisted in. */
  column: string;
  label: string;
}

/**
 * The three metrics the DAU/MAU dashboard is built from. Columns are resolved
 * through the ingest's own mapping rather than restated here — a second copy
 * would be free to drift from the thing it describes, which is the exact class
 * of bug this checker exists to catch.
 */
function metric(upstream: string, label: string): DriftMetric {
  const column = API_CORE_TO_KEY[upstream];
  if (!column) {
    // Loud at module load beats a checker that silently compares nothing.
    throw new Error(
      `drift: "${upstream}" is not in API_CORE_TO_KEY — the ingest mapping was renamed`,
    );
  }
  return { upstream, column, label };
}

export const DRIFT_METRICS: DriftMetric[] = [
  metric("dau_ga", "DAU (GA)"),
  metric("mau_ga", "MAU (rolling 30d)"),
  metric("total_views_homepage", "Homepage views"),
];

/** The settled window ending `unsettledDays` before `today`, inclusive. */
export function settledWindow(
  today: string,
  days = DRIFT_WINDOW_DAYS,
  unsettledDays = DRIFT_UNSETTLED_DAYS,
): DriftWindow & { dates: string[] } {
  const to = addDays(today, -unsettledDays);
  const from = addDays(to, -(days - 1));
  const dates = Array.from({ length: days }, (_, i) => addDays(from, i));
  return { from, to, days, unsettledDays, dates };
}

export interface StoredMetricRow {
  telco: string;
  date: string;
  isIntraday: boolean;
  /** `ow_daily_metrics` column → value. */
  values: Record<string, number | null | undefined>;
}

export interface UpstreamSeriesPoint {
  telco: string;
  date: string;
  /** BNII metric key → value. */
  metrics: Record<string, number | null | undefined>;
}

const key = (telco: string, date: string) => `${telco}|${date}`;

function numeric(v: number | null | undefined): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Does this upstream point carry any of the metrics we compare? */
function hasAnyMetric(point: UpstreamSeriesPoint): boolean {
  return DRIFT_METRICS.some((m) => numeric(point.metrics[m.upstream]) !== null);
}

export interface StoreComparison {
  findings: StoreDriftFinding[];
  comparisons: number;
  silentTelcos: string[];
}

/**
 * Diff what we persisted against what upstream says now, over the settled
 * window.
 *
 * Two deliberate silences, both there to stop an upstream problem masquerading
 * as our problem:
 *
 *   - a telco upstream has NO data for anywhere in the window is reported as
 *     silent and skipped entirely, rather than emitting a `missing_row` for
 *     every one of its days;
 *   - a single day upstream has no numbers for is skipped, because "we hold
 *     nothing and neither do they" is agreement, not drift.
 */
export function compareStoredToUpstream(input: {
  dates: string[];
  telcos: string[];
  stored: StoredMetricRow[];
  upstream: UpstreamSeriesPoint[];
}): StoreComparison {
  const window = new Set(input.dates);
  const upstreamByKey = new Map<string, UpstreamSeriesPoint>();
  const liveTelcos = new Set<string>();
  for (const p of input.upstream) {
    if (!window.has(p.date)) continue;
    upstreamByKey.set(key(p.telco, p.date), p);
    if (hasAnyMetric(p)) liveTelcos.add(p.telco);
  }

  const storedByKey = new Map<string, StoredMetricRow>();
  for (const r of input.stored) {
    if (window.has(r.date)) storedByKey.set(key(r.telco, r.date), r);
  }

  const findings: StoreDriftFinding[] = [];
  const silentTelcos: string[] = [];
  let comparisons = 0;

  for (const telco of input.telcos) {
    if (!liveTelcos.has(telco)) {
      silentTelcos.push(telco);
      continue;
    }
    for (const date of input.dates) {
      const up = upstreamByKey.get(key(telco, date));
      if (!up || !hasAnyMetric(up)) continue;

      const row = storedByKey.get(key(telco, date));
      if (!row) {
        findings.push({
          kind: "missing_row",
          telco,
          date,
          stored: null,
          upstream: null,
          delta: null,
          pctDelta: null,
        });
        continue;
      }
      if (row.isIntraday) {
        // The day has settled but the row is still flagged mid-day, so the
        // ingest never came back for it. Its values are expected to be short;
        // comparing them would just restate this one finding three times.
        findings.push({
          kind: "unsettled_row",
          telco,
          date,
          stored: null,
          upstream: null,
          delta: null,
          pctDelta: null,
        });
        continue;
      }

      for (const m of DRIFT_METRICS) {
        const upstream = numeric(up.metrics[m.upstream]);
        if (upstream === null) continue;
        const stored = numeric(row.values[m.column]);
        comparisons += 1;
        if (stored === null) {
          findings.push({
            kind: "missing_value",
            telco,
            date,
            metric: m.upstream,
            column: m.column,
            stored: null,
            upstream,
            delta: null,
            pctDelta: null,
          });
          continue;
        }
        if (stored !== upstream) {
          const delta = stored - upstream;
          findings.push({
            kind: "value_mismatch",
            telco,
            date,
            metric: m.upstream,
            column: m.column,
            stored,
            upstream,
            delta,
            pctDelta: upstream === 0 ? null : delta / upstream,
          });
        }
      }

      // Held by us, gone upstream — a restatement or a deletion. Worth naming
      // separately: it is the one direction a re-ingest will not fix.
      for (const m of DRIFT_METRICS) {
        if (numeric(up.metrics[m.upstream]) !== null) continue;
        const stored = numeric(row.values[m.column]);
        if (stored === null) continue;
        findings.push({
          kind: "orphan_value",
          telco,
          date,
          metric: m.upstream,
          column: m.column,
          stored,
          upstream: null,
          delta: null,
          pctDelta: null,
        });
      }
    }
  }

  return { findings, comparisons, silentTelcos };
}

// ── Cross-foot the dashboard's own published figures ─────────────
// Each assertion compares two numbers the payload already contains, reached by
// different aggregation orders (per-account-then-sum vs per-day-then-sum).
// Only exact sums are asserted — never a mean or a ratio, because those legally
// disagree when the underlying series have different null coverage, and an
// invariant that can fail honestly is worse than no invariant at all.

/** The slice of the dashboard payload these checks read. */
export interface CrossFootInput {
  accounts: Array<{ key: string; includeInEstate: boolean }>;
  lifetime: {
    rows: Array<{
      accountKey: string;
      totalSessions: number | null;
      dauOnAsOf: number | null;
      shareOfTotal: number | null;
    }>;
    estate: { totalSessions: number | null; dauOnAsOf: number | null };
  };
  sessions: {
    total: number | null;
    previousTotal: number | null;
    pacing: Array<{ current: number | null; previous: number | null }>;
    byTelco: Array<{ accountKey: string; total: number | null }>;
  };
}

/** Sum of present values; null when none are present — mirrors `sum` in the metrics module. */
function sumOf(values: Array<number | null | undefined>): number | null {
  const present = values.filter((v): v is number => typeof v === "number");
  return present.length === 0 ? null : present.reduce((a, b) => a + b, 0);
}

const ESTATE_KEY = "estate";

export function crossFootDashboard(input: CrossFootInput): {
  findings: CrossFootFinding[];
  checks: number;
} {
  const estateKeys = new Set(
    input.accounts
      .filter((a) => a.includeInEstate && a.key !== ESTATE_KEY)
      .map((a) => a.key),
  );
  const findings: CrossFootFinding[] = [];
  let checks = 0;

  const assertEqual = (
    check: string,
    detail: string,
    reported: number | null,
    recomputed: number | null,
    tolerance = 0,
  ) => {
    checks += 1;
    if (reported === null && recomputed === null) return;
    if (reported === null || recomputed === null) {
      findings.push({
        check,
        detail,
        reported,
        recomputed,
        delta: null,
      });
      return;
    }
    const delta = reported - recomputed;
    if (Math.abs(delta) > tolerance) {
      findings.push({ check, detail, reported, recomputed, delta });
    }
  };

  const estateLifetime = input.lifetime.rows.filter((r) =>
    estateKeys.has(r.accountKey),
  );

  assertEqual(
    "lifetime.estate.totalSessions",
    "Estate lifetime total vs the sum of its per-telco rows",
    input.lifetime.estate.totalSessions,
    sumOf(estateLifetime.map((r) => r.totalSessions)),
  );

  assertEqual(
    "lifetime.estate.dauOnAsOf",
    "Estate DAU as-of vs the sum of its per-telco rows",
    input.lifetime.estate.dauOnAsOf,
    sumOf(estateLifetime.map((r) => r.dauOnAsOf)),
  );

  // Shares are ratios against the estate total, so they must close on 1.
  // Guarded on a non-zero total: with no data every share is null and the
  // check has nothing to say.
  if ((input.lifetime.estate.totalSessions ?? 0) > 0) {
    assertEqual(
      "lifetime.shareOfTotal",
      "Per-telco shares of the estate should close on 100%",
      sumOf(estateLifetime.map((r) => r.shareOfTotal)),
      1,
      1e-6,
    );
  } else {
    checks += 1;
  }

  assertEqual(
    "sessions.total.vsPacing",
    "Sessions window total vs the sum of the pacing series it is charted from",
    input.sessions.total,
    sumOf(input.sessions.pacing.map((p) => p.current)),
  );

  assertEqual(
    "sessions.previousTotal.vsPacing",
    "Previous-window total vs the sum of the pacing overlay",
    input.sessions.previousTotal,
    sumOf(input.sessions.pacing.map((p) => p.previous)),
  );

  assertEqual(
    "sessions.total.vsByTelco",
    "Sessions window total vs the sum of its per-telco totals",
    input.sessions.total,
    sumOf(
      input.sessions.byTelco
        .filter((t) => estateKeys.has(t.accountKey))
        .map((t) => t.total),
    ),
  );

  return { findings, checks };
}

/**
 * Stable digest of a finding set, used to debounce the email.
 *
 * Deliberately excludes the values: a permanent upstream restatement would
 * otherwise re-alert every single day forever. Identity is what drifted, not
 * by how much — a changed magnitude on an already-reported day is the same
 * open problem, and a NEW day or metric changes the digest and re-alerts.
 */
export function driftFingerprint(input: {
  store: StoreDriftFinding[];
  crossFoot: CrossFootFinding[];
}): string {
  const parts = [
    ...input.store.map((f) =>
      ["store", f.kind, f.telco, f.date, f.metric ?? ""].join(":"),
    ),
    ...input.crossFoot.map((f) => ["xfoot", f.check].join(":")),
  ].sort();
  if (parts.length === 0) return "clean";
  return createHash("sha1").update(parts.join("|")).digest("hex").slice(0, 16);
}
