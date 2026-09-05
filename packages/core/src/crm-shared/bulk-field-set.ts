export interface BulkFieldSet {
  ownerId?: string;
  archived?: boolean;
  lifecycle?: string;
}

export interface BulkFieldResult {
  updated: number;
  skipped: number;
  failed: Array<{ id: string; reason: string }>;
}

export interface BulkFieldRow {
  id: string;
  ownerId: string;
  archivedAt: string | null;
  lifecycle: string;
}

export interface BulkFieldWriters {
  setOwner: (id: string, ownerId: string) => Promise<unknown>;
  archive: (id: string) => Promise<unknown>;
  unarchive: (id: string) => Promise<unknown>;
  setLifecycle?: (id: string, next: string) => Promise<unknown>;
}

export async function applyBulkFieldSet(
  rows: readonly BulkFieldRow[],
  set: BulkFieldSet,
  writers: BulkFieldWriters,
  _context: { module: string; actorId: string },
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
        if (!writers.setLifecycle) throw new Error("This record type cannot change stage in bulk.");
        await writers.setLifecycle(row.id, set.lifecycle!);
      }
      if (wantsArchive) {
        await (set.archived ? writers.archive(row.id) : writers.unarchive(row.id));
      }
      result.updated += 1;
    } catch (err) {
      result.failed.push({
        id: row.id,
        reason: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }
  return result;
}
