/**
 * Physical count / stocktake variance (WS4). Pure, no DB.
 *
 * A count session compares what the register SAYS is held against what a counter
 * physically found, and produces a variance list an accountant acts on.
 *
 * DELIBERATELY TOUCHES NO GL. A shortfall does not write the asset off here — it
 * produces a recommendation that the accountant routes into the EXISTING
 * write-off disposal flow, which already has approval, period locks, snapshots
 * and (in WS1) posting. Letting a counter's tap remove an asset from the books
 * would bypass every one of those controls.
 *
 * THE AS-OF TRAP. A year-end count is executed over the following fortnight, so
 * the expected quantity must be the quantity held ON THE COUNT DATE, not today.
 * Callers must supply expectations resolved through assetStateAt at the session's
 * as-of date; feeding live-row quantities makes a counter "correct" a register
 * that was right, and the correction is the error.
 */

export type CountLineStatus =
  | "matched"
  | "shortfall"
  | "surplus"
  | "not-counted"
  | "unregistered";

export interface CountExpectation {
  assetId: string;
  assetNo: string | null;
  name: string;
  categoryCode: string;
  location: string | null;
  /** Quantity the register says was held AS AT the session date. */
  expectedQuantity: number;
}

export interface CountObservation {
  /** Null for something found that is not in the register at all. */
  assetId: string | null;
  /** The tag/code the counter scanned or typed, kept for the audit trail. */
  scannedTag?: string | null;
  countedQuantity: number;
  note?: string | null;
}

export interface CountVarianceLine {
  assetId: string | null;
  assetNo: string | null;
  name: string;
  categoryCode: string | null;
  location: string | null;
  expectedQuantity: number;
  countedQuantity: number;
  /** counted − expected. Negative = missing units. */
  variance: number;
  status: CountLineStatus;
  scannedTag?: string | null;
  note?: string | null;
  /**
   * True when the accountant should raise a write-off through the existing
   * disposal approval flow. This module never writes one itself.
   */
  suggestWriteOff: boolean;
}

export interface CountVarianceSummary {
  expectedAssets: number;
  countedAssets: number;
  matched: number;
  shortfall: number;
  surplus: number;
  notCounted: number;
  unregistered: number;
  /** Net units missing across the session (positive = units missing). */
  netUnitsMissing: number;
}

export interface CountVarianceResult {
  lines: CountVarianceLine[];
  summary: CountVarianceSummary;
}

/**
 * Normalise a scanned tag for lookup. Scanners emit trailing whitespace and
 * newlines (keyboard-wedge devices append Enter), and label stock is printed in
 * mixed case.
 */
export function normalizeTag(raw: string): string {
  return raw.trim().replace(/\s+/g, "").toUpperCase();
}

/**
 * Resolve a scanned tag to an asset id. Returns null when the tag matches
 * nothing, and — importantly — also when it matches MORE THAN ONE asset:
 * `serialNo` is nullable, non-unique and never de-duplicated on import, so a
 * tag can genuinely be ambiguous. Guessing would attach the count to the wrong
 * asset and the counter would confirm it.
 */
export function resolveAssetByTag(
  tag: string,
  candidates: ReadonlyArray<{ assetId: string; tag: string | null }>,
): { assetId: string } | { ambiguous: true; count: number } | null {
  const needle = normalizeTag(tag);
  if (!needle) return null;
  const hits = candidates.filter(
    (c) => c.tag != null && normalizeTag(c.tag) === needle,
  );
  if (hits.length === 0) return null;
  if (hits.length > 1) return { ambiguous: true, count: hits.length };
  return { assetId: hits[0]!.assetId };
}

export function buildCountVariance(
  expectations: readonly CountExpectation[],
  observations: readonly CountObservation[],
): CountVarianceResult {
  // Multiple counters can submit the same asset (two people, one room), so
  // observations are summed rather than last-write-wins.
  const countedById = new Map<string, CountObservation[]>();
  const unregistered: CountObservation[] = [];
  for (const o of observations) {
    if (o.assetId === null) {
      unregistered.push(o);
      continue;
    }
    const list = countedById.get(o.assetId) ?? [];
    list.push(o);
    countedById.set(o.assetId, list);
  }

  const lines: CountVarianceLine[] = [];

  for (const e of expectations) {
    const obs = countedById.get(e.assetId);
    if (!obs) {
      // NOT the same as counting zero. An uncounted asset is a gap in the count;
      // a zero count is a positive assertion that nothing was there.
      lines.push({
        assetId: e.assetId,
        assetNo: e.assetNo,
        name: e.name,
        categoryCode: e.categoryCode,
        location: e.location,
        expectedQuantity: e.expectedQuantity,
        countedQuantity: 0,
        variance: 0,
        status: "not-counted",
        suggestWriteOff: false,
      });
      continue;
    }
    const countedQuantity = obs.reduce((s, o) => s + o.countedQuantity, 0);
    const variance = countedQuantity - e.expectedQuantity;
    const status: CountLineStatus =
      variance === 0 ? "matched" : variance < 0 ? "shortfall" : "surplus";
    lines.push({
      assetId: e.assetId,
      assetNo: e.assetNo,
      name: e.name,
      categoryCode: e.categoryCode,
      location: e.location,
      expectedQuantity: e.expectedQuantity,
      countedQuantity,
      variance,
      status,
      scannedTag: obs.find((o) => o.scannedTag)?.scannedTag ?? null,
      note: obs.find((o) => o.note)?.note ?? null,
      suggestWriteOff: variance < 0,
    });
  }

  for (const o of unregistered) {
    lines.push({
      assetId: null,
      assetNo: null,
      name: o.note?.trim() || "Unregistered asset",
      categoryCode: null,
      location: null,
      expectedQuantity: 0,
      countedQuantity: o.countedQuantity,
      variance: o.countedQuantity,
      status: "unregistered",
      scannedTag: o.scannedTag ?? null,
      note: o.note ?? null,
      suggestWriteOff: false,
    });
  }

  const by = (s: CountLineStatus) => lines.filter((l) => l.status === s).length;

  return {
    lines,
    summary: {
      expectedAssets: expectations.length,
      countedAssets: countedById.size + unregistered.length,
      matched: by("matched"),
      shortfall: by("shortfall"),
      surplus: by("surplus"),
      notCounted: by("not-counted"),
      unregistered: by("unregistered"),
      netUnitsMissing: lines
        .filter((l) => l.status === "shortfall")
        .reduce((s, l) => s - l.variance, 0),
    },
  };
}
