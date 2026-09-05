import { prisma } from "@/infrastructure/database/prisma";

/**
 * Admin-set default column layouts, one `SystemSetting` row per table.
 *
 * Follows the global-config-block pattern (see `payroll.service.ts`
 * `getPayslipCompany`): a single JSON row, no schema migration, and a code
 * fallback when the row is absent — so every table renders its code default
 * until an admin overrides it.
 *
 * This stores only the ORG DEFAULT. A per-user override lives in the browser's
 * localStorage and is layered on top client-side; the server never holds
 * per-user layouts, which keeps this free of per-user rows.
 */
export const TABLE_LAYOUT_KEY_PREFIX = "table-layout.";

/** Mirrors MIN_COLUMN_WIDTH in apps/web/src/components/shared/use-column-widths.ts. */
const MIN_COLUMN_WIDTH = 56;

export interface TableLayout {
  order: string[];
  hidden: string[];
  widths: Record<string, number>;
  /**
   * Manual row order, by row key. Only meaningful for tables whose rows have
   * a stable identity (accountKey, date, campaign key). Rows whose keys are
   * absent fall to the end in their natural order, so narrowing a date range
   * can never hide data behind a stale arrangement.
   */
  rowOrder: string[];
}

const EMPTY: TableLayout = { order: [], hidden: [], widths: {}, rowOrder: [] };

/**
 * Type-guard every field. The row is free-form JSON that an admin wrote
 * through the API and that a future schema change may outgrow, so nothing
 * here trusts its shape — a malformed row degrades to "no default" rather
 * than throwing on read and taking the whole table down with it.
 */
export function normalizeLayout(value: unknown): TableLayout {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...EMPTY };
  }
  const v = value as Record<string, unknown>;
  const strings = (x: unknown): string[] =>
    Array.isArray(x) ? x.filter((k): k is string => typeof k === "string") : [];

  const widths: Record<string, number> = {};
  if (v.widths && typeof v.widths === "object" && !Array.isArray(v.widths)) {
    for (const [k, w] of Object.entries(v.widths as Record<string, unknown>)) {
      if (typeof w === "number" && Number.isFinite(w)) {
        widths[k] = Math.max(MIN_COLUMN_WIDTH, Math.round(w));
      }
    }
  }

  return {
    order: strings(v.order),
    hidden: strings(v.hidden),
    widths,
    rowOrder: strings(v.rowOrder),
  };
}

export const tableLayoutsService = {
  /** The admin default for a table, or null when none has been saved. */
  async get(tableId: string): Promise<TableLayout | null> {
    const row = await prisma.systemSetting.findUnique({
      where: { key: TABLE_LAYOUT_KEY_PREFIX + tableId },
    });
    return row ? normalizeLayout(row.value) : null;
  },

  async set(tableId: string, input: unknown): Promise<TableLayout> {
    const layout = normalizeLayout(input);
    await prisma.systemSetting.upsert({
      where: { key: TABLE_LAYOUT_KEY_PREFIX + tableId },
      // Inline object literals: a typed variable trips Prisma's
      // InputJsonValue (see the payslip-company note in CLAUDE.md).
      create: {
        key: TABLE_LAYOUT_KEY_PREFIX + tableId,
        value: {
          order: layout.order,
          hidden: layout.hidden,
          widths: layout.widths,
          rowOrder: layout.rowOrder,
        },
      },
      update: {
        value: {
          order: layout.order,
          hidden: layout.hidden,
          widths: layout.widths,
          rowOrder: layout.rowOrder,
        },
      },
    });
    return layout;
  },

  /**
   * Drop the org default so every user falls back to the code default.
   * `deleteMany` rather than `delete`: clearing an absent default is success,
   * not a P2025.
   */
  async clear(tableId: string): Promise<void> {
    await prisma.systemSetting.deleteMany({
      where: { key: TABLE_LAYOUT_KEY_PREFIX + tableId },
    });
  },
};
