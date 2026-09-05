import { logger } from "@/common/utils/logger";
import {
  type BulkBusinessUnitMode,
  nextBusinessUnits,
} from "@/modules/crm-shared/bulk-business-units";

/**
 * Outcome of a bulk action. Reported honestly per row rather than as a single
 * success flag, because a bulk write over N rows genuinely can partially
 * succeed and telling the user "done" when 3 of 40 failed is worse than
 * telling them nothing.
 */
export interface BulkApplyResult {
  /** Rows actually written. */
  updated: number;
  /** Rows already carrying the requested set — no write attempted. */
  skipped: number;
  /** Rows whose write threw. The action continues past a failure. */
  failed: Array<{ id: string; reason: string }>;
}

/**
 * Apply a business-unit assignment across pre-fetched rows.
 *
 * Sequential, not `Promise.all`, and that is deliberate for opportunities: each
 * write runs a per-unit reconcile plus a roll-up recompute, and firing dozens
 * concurrently would have them contend on the same child rows. Accounts and
 * leads would tolerate concurrency, but one predictable code path across all
 * three is worth more than the latency.
 *
 * Rows whose tag set is already correct are skipped rather than rewritten —
 * `nextBusinessUnits` returns `null` for those. On an opportunity that avoids a
 * pointless reconcile and recompute; everywhere it avoids touching `updatedAt`
 * on a record the action did not change.
 */
export async function applyBulkBusinessUnits<
  TRow extends { id: string; businessUnits: string[] },
>(
  rows: readonly TRow[],
  requested: readonly string[],
  mode: BulkBusinessUnitMode,
  write: (id: string, next: string[], row: TRow) => Promise<unknown>,
  context: { module: string; actorId: string },
): Promise<BulkApplyResult> {
  const result: BulkApplyResult = { updated: 0, skipped: 0, failed: [] };

  for (const row of rows) {
    const next = nextBusinessUnits(row.businessUnits, requested, mode);
    if (next === null) {
      result.skipped += 1;
      continue;
    }
    try {
      await write(row.id, next, row);
      result.updated += 1;
    } catch (err) {
      const reason = err instanceof Error ? err.message : "Unknown error";
      result.failed.push({ id: row.id, reason });
      // One row failing must not abort the batch, but it must not vanish
      // either — the caller surfaces `failed` and this records the detail.
      logger.warn("Bulk business-unit write failed for one row", {
        module: context.module,
        actorId: context.actorId,
        recordId: row.id,
        reason,
      });
    }
  }

  return result;
}
