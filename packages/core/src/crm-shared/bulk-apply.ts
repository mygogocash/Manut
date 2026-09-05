import {
  type BulkBusinessUnitMode,
  nextBusinessUnits,
} from "./bulk-business-units";

export interface BulkApplyResult {
  updated: number;
  skipped: number;
  failed: Array<{ id: string; reason: string }>;
}

export async function applyBulkBusinessUnits<
  TRow extends { id: string; businessUnits: string[] },
>(
  rows: readonly TRow[],
  requested: readonly string[],
  mode: BulkBusinessUnitMode,
  write: (id: string, next: string[], row: TRow) => Promise<unknown>,
  _context: { module: string; actorId: string },
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
      result.failed.push({
        id: row.id,
        reason: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }
  return result;
}
