import { api } from "@/lib/api-client";
import type { ApiSuccessResponse } from "@/types/api.type";

/**
 * A table's column arrangement. Every field is optional in transit: a caller
 * that only reorders sends only `order`, and the resolver leaves the other
 * layers showing through.
 */
export interface TableLayout {
  order: string[];
  hidden: string[];
  widths: Record<string, number>;
  /**
   * Manual row order, by row key. Rows whose keys are absent fall to the end
   * in their natural order, so a narrower date range never hides data behind
   * a stale arrangement.
   */
  rowOrder: string[];
}

/** The organisation-wide default, or null when no admin has set one. */
export function getTableLayout(tableId: string) {
  return api.get<ApiSuccessResponse<TableLayout | null>>(
    `/table-layouts/${tableId}`,
  );
}

/** Admin only. Makes the given layout the default every user starts from. */
export function putTableLayout(tableId: string, layout: Partial<TableLayout>) {
  return api.put<ApiSuccessResponse<TableLayout>>(
    `/table-layouts/${tableId}`,
    layout,
  );
}

/** Admin only. Drops the default so everyone falls back to the code order. */
export function deleteTableLayout(tableId: string) {
  return api.delete<void>(`/table-layouts/${tableId}`);
}
