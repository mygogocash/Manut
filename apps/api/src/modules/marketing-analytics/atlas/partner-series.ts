/**
 * Turns one partner's raw BNII daily response into the two shapes the Atlas
 * screens need:
 *
 *   - a per-field daily series, keyed by ATLAS field name, which the metrics
 *     evaluator walks (`sum(x, 7d)`, `x[t-1]`, …)
 *   - a 30-day headline per field for the Raw Data table
 *
 * This is where the three id spaces get reconciled. Upstream BNII keys are
 * mapped to Atlas field names, fields fed by several keys are summed, and the
 * keys upstream reports as negative debits are made absolute.
 *
 * Pure — no I/O. Unit tested in __tests__/partner-series.test.ts.
 */
import {
  type AtlasFieldAgg,
  type AtlasRawField,
  shownRawFields,
} from "@/modules/marketing-analytics/atlas/atlas-fields";

export interface DailyPoint {
  date: string;
  metrics: Record<string, number | null>;
}

/**
 * Per-field daily values, date-ascending, keyed by Atlas field name.
 *
 * Each field carries its OWN array containing only the days it reported, so a
 * gap in one feed cannot shift another field's window. This matches Atlas,
 * whose per-field series come from separate DB rows. In practice BNII reports
 * every field every day, so the arrays are the same length.
 */
export type SeriesByField = Record<string, number[]>;

function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/**
 * Collapse a day's upstream values for one field into a single number.
 * Returns null when the day reported none of the field's upstream keys —
 * a field summed from several keys still counts if at least one reported.
 */
function valueForDay(
  field: AtlasRawField,
  metrics: Record<string, number | null>,
): number | null {
  let total = 0;
  let seen = false;
  for (const key of field.upstream) {
    const raw = metrics?.[key];
    if (!isNum(raw)) continue;
    seen = true;
    total += field.abs ? Math.abs(raw) : raw;
  }
  return seen ? total : null;
}

/** Build the per-field series for one partner. */
export function buildPartnerSeries(
  points: DailyPoint[],
  fields: AtlasRawField[] = shownRawFields(),
): SeriesByField {
  // Sort defensively — upstream series order is not guaranteed.
  const ordered = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const out: SeriesByField = {};
  for (const field of fields) {
    if (!field.bnii || field.upstream.length === 0) continue;
    const values: number[] = [];
    for (const pt of ordered) {
      const v = valueForDay(field, pt.metrics);
      if (v !== null) values.push(v);
    }
    if (values.length > 0) out[field.bnii] = values;
  }
  return out;
}

/**
 * The window headline for a field.
 *
 * `sum` totals the window, `avg` means over reporting days only, and `last`
 * takes the most recent reported day — the rolling-30 MAU is already a 30-day
 * figure, so summing it would multiply it by 30.
 */
export function headline(
  values: number[] | undefined,
  agg: AtlasFieldAgg,
): number | null {
  if (!values || values.length === 0) return null;
  switch (agg) {
    case "sum":
      return values.reduce((a, b) => a + b, 0);
    case "avg":
      return values.reduce((a, b) => a + b, 0) / values.length;
    case "last":
      return values[values.length - 1];
  }
}

/** Round for display: averages keep one decimal, counts stay whole. */
export function roundHeadline(
  value: number | null,
  agg: AtlasFieldAgg,
): number | null {
  if (value === null) return null;
  return agg === "avg" ? Math.round(value * 10) / 10 : Math.round(value);
}
