/**
 * The plain-field half of Sales CRM bulk actions: owner reassignment and
 * archive/unarchive.
 *
 * Kept separate from `bulk-business-units.ts` deliberately. A tag assignment has
 * two MODES (add vs replace) and a per-record computed result; owner and archive
 * are a flat "set this value on the selection". Folding both into one payload
 * would make the shape lie about one of them.
 */

import { logger } from "@/common/utils/logger";

/** What a bulk field-set request may change. At least one must be present. */
export interface BulkFieldSet {
  /** Reassign owner. Requires `crm:reassign` — enforced in the service. */
  ownerId?: string;
  /** true archives, false unarchives. */
  archived?: boolean;
  /**
   * Opportunity stage or lead status. Restricted to the non-terminal values by
   * the module schemas — see BULK_SETTABLE_STAGES / REP_SETTABLE_STATUSES.
   */
  lifecycle?: string;
}

export interface BulkFieldResult {
  updated: number;
  /** Rows already in the requested state — no write attempted. */
  skipped: number;
  failed: Array<{ id: string; reason: string }>;
}

/**
 * Row shape the loop needs to decide whether a write is necessary.
 *
 * `archivedAt` rather than a boolean because that is what the column is, and
 * comparing against it is how "already archived" is detected without a second
 * query.
 */
export interface BulkFieldRow {
  id: string;
  ownerId: string;
  archivedAt: Date | null;
  /** Current stage (opportunity) or status (lead). */
  lifecycle: string;
}

export interface BulkFieldWriters {
  /** Reuses the single-record update, so per-row authz and side effects run. */
  setOwner: (id: string, ownerId: string) => Promise<unknown>;
  archive: (id: string) => Promise<unknown>;
  unarchive: (id: string) => Promise<unknown>;
  /**
   * Stage/status. Present only where the type supports it; a module that
   * cannot set it omits the writer and the loop reports the attempt as failed
   * rather than silently ignoring it.
   */
  setLifecycle?: (id: string, next: string) => Promise<unknown>;
}

/**
 * Apply a field set across pre-fetched rows.
 *
 * Sequential and per-row fault-tolerant for the same reasons as
 * `applyBulkBusinessUnits`: one row failing (a stage guard, a vanished record)
 * must not abort the batch, and it must be reported rather than swallowed.
 *
 * Order within a row matters: owner, then stage/status, then archive. Archiving
 * first would fight any archived-row write guard on the other two, and
 * "reassign, move, then file away" is the sequence a human would perform.
 *
 * A row whose stage move is refused by a guard (an opportunity that is
 * closed_won and must be reopened first, say) lands in `failed` with the
 * service's own message — the guard is honoured per row, never bypassed, and
 * never silently skipped.
 */
export async function applyBulkFieldSet(
  rows: readonly BulkFieldRow[],
  set: BulkFieldSet,
  writers: BulkFieldWriters,
  context: { module: string; actorId: string },
): Promise<BulkFieldResult> {
  const result: BulkFieldResult = { updated: 0, skipped: 0, failed: [] };

  for (const row of rows) {
    const wantsOwner = set.ownerId !== undefined && set.ownerId !== row.ownerId;
    const wantsArchive =
      set.archived !== undefined && set.archived !== (row.archivedAt !== null);
    const wantsLifecycle =
      set.lifecycle !== undefined && set.lifecycle !== row.lifecycle;

    if (!wantsOwner && !wantsArchive && !wantsLifecycle) {
      result.skipped += 1;
      continue;
    }

    try {
      if (wantsOwner) await writers.setOwner(row.id, set.ownerId!);
      if (wantsLifecycle) {
        if (!writers.setLifecycle) {
          throw new Error("This record type cannot change stage in bulk.");
        }
        await writers.setLifecycle(row.id, set.lifecycle!);
      }
      if (wantsArchive) {
        await (set.archived
          ? writers.archive(row.id)
          : writers.unarchive(row.id));
      }
      result.updated += 1;
    } catch (err) {
      const reason = err instanceof Error ? err.message : "Unknown error";
      result.failed.push({ id: row.id, reason });
      logger.warn("Bulk field-set write failed for one row", {
        module: context.module,
        actorId: context.actorId,
        recordId: row.id,
        reason,
      });
    }
  }

  return result;
}
