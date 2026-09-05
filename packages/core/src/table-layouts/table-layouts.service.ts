import { eq } from "drizzle-orm";
import type { Db } from "@nexora/db";
import { schema } from "@nexora/db";
import { getSetting, upsertSetting } from "../lib/system-settings";

export const TABLE_LAYOUT_KEY_PREFIX = "table-layout.";
const MIN_COLUMN_WIDTH = 56;

export interface TableLayout {
  order: string[];
  hidden: string[];
  widths: Record<string, number>;
  rowOrder: string[];
}

const EMPTY: TableLayout = { order: [], hidden: [], widths: {}, rowOrder: [] };

export function normalizeLayout(value: unknown): TableLayout {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ...EMPTY };
  const v = value as Record<string, unknown>;
  const strings = (x: unknown): string[] =>
    Array.isArray(x) ? x.filter((k): k is string => typeof k === "string") : [];

  const widths: Record<string, number> = {};
  if (v.widths && typeof v.widths === "object" && !Array.isArray(v.widths)) {
    for (const [k, w] of Object.entries(v.widths as Record<string, unknown>)) {
      if (typeof w === "number" && Number.isFinite(w)) widths[k] = Math.max(MIN_COLUMN_WIDTH, Math.round(w));
    }
  }

  return { order: strings(v.order), hidden: strings(v.hidden), widths, rowOrder: strings(v.rowOrder) };
}

export async function get(db: Db, tableId: string): Promise<TableLayout | null> {
  const raw = await getSetting(db, TABLE_LAYOUT_KEY_PREFIX + tableId);
  return raw == null ? null : normalizeLayout(raw);
}

export async function set(db: Db, tableId: string, input: unknown): Promise<TableLayout> {
  const layout = normalizeLayout(input);
  await upsertSetting(db, TABLE_LAYOUT_KEY_PREFIX + tableId, {
    order: layout.order,
    hidden: layout.hidden,
    widths: layout.widths,
    rowOrder: layout.rowOrder,
  });
  return layout;
}

export async function clear(db: Db, tableId: string): Promise<void> {
  await db.delete(schema.systemSettings).where(eq(schema.systemSettings.key, TABLE_LAYOUT_KEY_PREFIX + tableId));
}
