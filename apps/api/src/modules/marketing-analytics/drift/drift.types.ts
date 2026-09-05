// Shapes for the DAU/MAU drift check. Kept apart from the logic so the pure
// comparison in `drift.check.ts` can be unit tested without dragging in Prisma
// or the BNII client.

/**
 * How a persisted day disagrees with the upstream it was ingested from.
 *
 * Row-level kinds (`missing_row`, `unsettled_row`) are reported once per
 * (telco, date); the per-metric kinds are reported once per metric. That split
 * matters — a telco that never ingested a day would otherwise produce one
 * finding per metric and drown the real mismatches.
 */
export type StoreDriftKind =
  | "missing_row"
  | "unsettled_row"
  | "missing_value"
  | "orphan_value"
  | "value_mismatch";

export interface StoreDriftFinding {
  kind: StoreDriftKind;
  telco: string;
  date: string;
  /** BNII metric key. Absent on the row-level kinds. */
  metric?: string;
  /** `ow_daily_metrics` column the metric lands in. Absent on row-level kinds. */
  column?: string;
  stored: number | null;
  upstream: number | null;
  delta: number | null;
  pctDelta: number | null;
}

/**
 * A published total that does not equal the parts it is published alongside.
 * These are cross-foots, not a re-implementation: each compares two figures the
 * dashboard already returns, reached by different aggregation orders. A second
 * implementation of the same maths would drift from the real one and cry wolf.
 */
export interface CrossFootFinding {
  check: string;
  detail: string;
  reported: number | null;
  recomputed: number | null;
  delta: number | null;
}

export interface DriftWindow {
  from: string;
  to: string;
  days: number;
  unsettledDays: number;
}

export interface DriftReport {
  ranAt: string;
  window: DriftWindow;
  /**
   * True when the run could not reach a verdict — upstream returned nothing
   * usable. Never email on an inconclusive run: a BNII outage would otherwise
   * report every stored day as drift.
   */
  inconclusive: boolean;
  reason: string | null;
  /** Telcos upstream had no data for at all; excluded rather than reported. */
  silentTelcos: string[];
  store: {
    comparisons: number;
    findings: StoreDriftFinding[];
  };
  crossFoot: {
    checks: number;
    findings: CrossFootFinding[];
  };
  /** Stable digest of the finding set; drives the email debounce. */
  fingerprint: string;
  emailed: boolean;
  emailSkippedReason: string | null;
  recipients: number;
}
