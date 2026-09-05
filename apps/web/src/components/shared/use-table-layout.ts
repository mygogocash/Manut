"use client";

import { arrayMove } from "@dnd-kit/sortable";
import { useCallback, useEffect, useMemo, useState } from "react";

import { mergeStoredColumnOrder } from "@/components/shared/use-column-order";
import {
  deleteTableLayout,
  getTableLayout,
  putTableLayout,
  type TableLayout,
} from "@/services/table-layout.service";

export type { TableLayout };

const STORAGE_PREFIX = "table-layout.";

/**
 * Code defaults < admin default < user override, resolved per field.
 *
 * Each layer is partial on purpose: a layer that says nothing about widths
 * leaves the layer beneath it showing through, so an admin who only reorders
 * columns does not silently wipe every user's column widths.
 *
 * Order runs through `mergeStoredColumnOrder`, so a column added to the code
 * default after a layout was saved lands beside its neighbours instead of
 * being appended past every column the user has ever seen — the same bug that
 * stranded Rev. GoLive at the far right of the Project CRM list.
 */
export function resolveLayout(
  code: TableLayout,
  admin: TableLayout | null,
  user: TableLayout | null,
): TableLayout {
  const known = new Set(code.order);
  const keep = (keys: string[]) => keys.filter((k) => known.has(k));
  const pickOrder = (l: TableLayout | null) =>
    l && l.order.length > 0
      ? mergeStoredColumnOrder(keep(l.order), code.order)
      : null;
  const pickHidden = (l: TableLayout | null) => (l ? keep(l.hidden) : null);
  const pickWidths = (l: TableLayout | null) =>
    l && Object.keys(l.widths).length > 0 ? l.widths : null;
  // Row keys are data, not schema, so they are NOT filtered against the code
  // layout the way column keys are — a row absent from this payload may be
  // back in the next one, and dropping it here would quietly forget the
  // reader's arrangement every time the date range moved.
  const pickRows = (l: TableLayout | null) =>
    l && l.rowOrder.length > 0 ? l.rowOrder : null;

  return {
    order: pickOrder(user) ?? pickOrder(admin) ?? [...code.order],
    hidden: pickHidden(user) ?? pickHidden(admin) ?? [...code.hidden],
    widths: pickWidths(user) ?? pickWidths(admin) ?? { ...code.widths },
    rowOrder: pickRows(user) ?? pickRows(admin) ?? [...code.rowOrder],
  };
}

function readUserLayout(tableId: string): TableLayout | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + tableId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const v = parsed as Partial<TableLayout>;
    return {
      order: Array.isArray(v.order) ? v.order : [],
      hidden: Array.isArray(v.hidden) ? v.hidden : [],
      rowOrder: Array.isArray(v.rowOrder) ? v.rowOrder : [],
      widths:
        v.widths && typeof v.widths === "object"
          ? v.widths
          : ({} as Record<string, number>),
    };
  } catch {
    return null; // corrupt storage — fall back to the admin/code layers
  }
}

/**
 * Column layout for one table, layering the org default under the user's own
 * arrangement.
 *
 * SSR and first paint render the code default, then the stored layers are
 * applied in an effect — server and client markup must match, so nothing may
 * read localStorage during render.
 */
export function useTableLayout(tableId: string, code: TableLayout) {
  const [admin, setAdmin] = useState<TableLayout | null>(null);
  const [user, setUser] = useState<TableLayout | null>(null);

  useEffect(() => {
    setUser(readUserLayout(tableId));
    let cancelled = false;
    void getTableLayout(tableId)
      .then((res) => {
        if (!cancelled) setAdmin(res.data);
      })
      .catch(() => {
        // No default set, or the caller cannot read one. Either way the code
        // default is a correct answer — never block the table on this.
      });
    return () => {
      cancelled = true;
    };
  }, [tableId]);

  const layout = useMemo(
    () => resolveLayout(code, admin, user),
    [code, admin, user],
  );

  const persistUser = useCallback(
    (next: TableLayout) => {
      setUser(next);
      if (typeof window === "undefined") return;
      try {
        window.localStorage.setItem(
          STORAGE_PREFIX + tableId,
          JSON.stringify(next),
        );
      } catch {
        // quota or disabled storage — the in-memory layout still applies
      }
    },
    [tableId],
  );

  const reorder = useCallback(
    (activeId: string, overId: string) => {
      const from = layout.order.indexOf(activeId);
      const to = layout.order.indexOf(overId);
      if (from < 0 || to < 0 || from === to) return;
      persistUser({ ...layout, order: arrayMove(layout.order, from, to) });
    },
    [layout, persistUser],
  );

  const toggleHidden = useCallback(
    (key: string) => {
      const hidden = layout.hidden.includes(key)
        ? layout.hidden.filter((k) => k !== key)
        : [...layout.hidden, key];
      // Never let the last column be hidden — an empty table has no way back.
      if (hidden.length >= code.order.length) return;
      persistUser({ ...layout, hidden });
    },
    [layout, code.order.length, persistUser],
  );

  /**
   * Move one row before/after another and remember it. The incoming
   * `visibleKeys` are this render's rows in their current order, so a table
   * that has never been arranged still produces a complete order on the first
   * drag rather than a two-element list.
   */
  const reorderRow = useCallback(
    (activeKey: string, overKey: string, visibleKeys: string[]) => {
      const base =
        layout.rowOrder.length > 0
          ? mergeStoredColumnOrder(layout.rowOrder, visibleKeys)
          : visibleKeys;
      const from = base.indexOf(activeKey);
      const to = base.indexOf(overKey);
      if (from < 0 || to < 0 || from === to) return;
      persistUser({ ...layout, rowOrder: arrayMove(base, from, to) });
    },
    [layout, persistUser],
  );

  const setWidth = useCallback(
    (key: string, width: number) => {
      persistUser({ ...layout, widths: { ...layout.widths, [key]: width } });
    },
    [layout, persistUser],
  );

  const resetToDefault = useCallback(() => {
    setUser(null);
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(STORAGE_PREFIX + tableId);
    } catch {
      // ignore
    }
  }, [tableId]);

  /**
   * Admin only. Publishes the arrangement on screen as the org default, then
   * drops the local override so the admin immediately sees what everyone else
   * will — rather than their own copy masking a botched save.
   */
  const saveAsDefault = useCallback(async () => {
    const res = await putTableLayout(tableId, layout);
    setAdmin(res.data);
    resetToDefault();
  }, [tableId, layout, resetToDefault]);

  const clearDefault = useCallback(async () => {
    await deleteTableLayout(tableId);
    setAdmin(null);
  }, [tableId]);

  const isHidden = useCallback(
    (key: string) => layout.hidden.includes(key),
    [layout.hidden],
  );

  const visibleOrder = useMemo(
    () => layout.order.filter((k) => !layout.hidden.includes(k)),
    [layout],
  );

  return {
    order: layout.order,
    rowOrder: layout.rowOrder,
    reorderRow,
    visibleOrder,
    hidden: layout.hidden,
    widths: layout.widths,
    isHidden,
    toggleHidden,
    reorder,
    setWidth,
    resetToDefault,
    saveAsDefault,
    clearDefault,
    hasUserOverride: user !== null,
    hasAdminDefault: admin !== null,
  };
}
