/**
 * Compute the next `businessUnits` tag set for a bulk assignment.
 *
 * Pure, and separated from the write paths deliberately: the three record types
 * persist tags very differently — an opportunity has to route through
 * `syncBusinessUnitsAfterWrite` so its per-unit child rows are seeded, while
 * accounts and leads are a plain array write — but they must all agree on WHAT
 * the resulting set is. That agreement is arithmetic, so it is unit-testable
 * without a database.
 */

export type BulkBusinessUnitMode = "add" | "replace";

/**
 * Returns the new tag array, or `null` when the record already has exactly
 * this set and no write is needed.
 *
 * `null` is not an optimisation detail — it is load-bearing for opportunities.
 * Every opportunity write runs a per-unit reconcile plus a roll-up recompute,
 * so skipping unchanged rows avoids doing that work (and touching `updatedAt`)
 * on records the action does not actually change.
 *
 *   * `add`     — union, existing order preserved, new codes appended. Never
 *                 removes a tag, so a mis-aimed bulk apply cannot strip units
 *                 (and on an opportunity, cannot delete a per-unit row along
 *                 with that unit's own stage, value and close date).
 *   * `replace` — the requested set becomes the whole set. Destructive by
 *                 design; the caller is responsible for confirming it.
 *
 * Both modes de-duplicate, because the tag column is a set in meaning even
 * though Postgres stores it as an ordered `text[]`.
 */
export function nextBusinessUnits(
  current: readonly string[],
  requested: readonly string[],
  mode: BulkBusinessUnitMode,
): string[] | null {
  const wanted = [...new Set(requested)];

  const next =
    mode === "replace"
      ? wanted
      : [...current, ...wanted.filter((code) => !current.includes(code))];

  const deduped = [...new Set(next)];

  return sameSet(current, deduped) ? null : deduped;
}

/**
 * Order-insensitive comparison. `add` preserves order so a same-set result is
 * usually also same-order, but `replace` can reorder without changing meaning,
 * and reordering alone is not worth a write.
 */
function sameSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const left = new Set(a);
  for (const code of b) {
    if (!left.has(code)) return false;
  }
  return true;
}

/**
 * How many per-unit child rows a `replace` would delete across a set of
 * opportunities — the number the confirm dialog has to state before the write.
 *
 * Counted from the units each deal currently has, not from the deal-level tag
 * array: the two are kept in step by `syncBusinessUnitsAfterWrite`, but the
 * child rows are the thing that actually carries the history being destroyed.
 */
export function countUnitRowsLostByReplace(
  deals: ReadonlyArray<{ units: readonly string[] }>,
  requested: readonly string[],
): number {
  const keep = new Set(requested);
  return deals.reduce(
    (total, deal) =>
      total + deal.units.filter((code) => !keep.has(code)).length,
    0,
  );
}
