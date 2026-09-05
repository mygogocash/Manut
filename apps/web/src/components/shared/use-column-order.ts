"use client";

import { arrayMove } from "@dnd-kit/sortable";
import { useCallback, useEffect, useState } from "react";

// Shared column-order state for CRM list tables. Each table passes a
// stable storageKey + its default key order; the hook persists user
// reordering in localStorage and tolerates schema drift (unknown keys
// dropped, newly-added default keys appended). Mirrors the original
// inline implementations in it-crm-list / voucher-crm-list (#665 era).
/**
 * Reconcile a stored column layout against the current default order.
 *
 * Keys the table no longer defines are dropped. Keys added to defaultOrder
 * after the layout was stored (a new column, or one restored after removal)
 * are spliced in at their default-relative slot rather than appended —
 * appended, a restored column lands past every column the user has ever seen
 * and reads as still missing.
 *
 * The anchor is the newcomer's NEAREST neighbour in defaultOrder that survives
 * in the stored layout: the closest preceding key, or the closest following one
 * when nothing precedes it. Both fallbacks matter — anchoring on the last
 * preceding key drags the newcomer to the end when a predecessor was moved
 * there, and anchoring on the first following key teleports it to index 0 when
 * a follower was moved to the front.
 */
export function mergeStoredColumnOrder<K extends string>(
  stored: readonly unknown[],
  defaultOrder: readonly K[],
): K[] {
  const next = stored.filter((k): k is K => defaultOrder.includes(k as K));
  // Ascending, so a run of new keys anchors on the ones already spliced in.
  for (const key of defaultOrder) {
    if (next.includes(key)) continue;
    const target = defaultOrder.indexOf(key);
    let pos = -1;
    for (let i = target - 1; i >= 0 && pos < 0; i--) {
      const at = next.indexOf(defaultOrder[i]);
      if (at >= 0) pos = at + 1;
    }
    for (let i = target + 1; i < defaultOrder.length && pos < 0; i++) {
      const at = next.indexOf(defaultOrder[i]);
      if (at >= 0) pos = at;
    }
    next.splice(pos < 0 ? next.length : pos, 0, key);
  }
  return next;
}

export function useColumnOrder<K extends string>(
  storageKey: string,
  defaultOrder: readonly K[],
) {
  // SSR renders the default order; the effect below hydrates from
  // localStorage on mount so server/client markup stays in sync.
  const [colOrder, setColOrder] = useState<K[]>(() => [...defaultOrder]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return;
      setColOrder(mergeStoredColumnOrder(parsed, defaultOrder));
    } catch {
      // corrupt storage — keep the default order
    }
    // defaultOrder is expected to be a module-level constant (stable ref)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const persistColOrder = useCallback(
    (next: K[]) => {
      setColOrder(next);
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {
          // ignore quota / disabled storage
        }
      }
    },
    [storageKey],
  );

  // Column ids are short literal strings, distinct from the row UUIDs a
  // table may also drag — callers route a dnd `active.id` through this to
  // tell a header drag from a row drag.
  const isColumnId = useCallback(
    (id: unknown): id is K => defaultOrder.includes(id as K),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const reorderColumns = useCallback(
    (activeId: K, overId: K) => {
      const from = colOrder.indexOf(activeId);
      const to = colOrder.indexOf(overId);
      if (from < 0 || to < 0 || from === to) return;
      persistColOrder(arrayMove(colOrder, from, to));
    },
    [colOrder, persistColOrder],
  );

  return { colOrder, persistColOrder, isColumnId, reorderColumns };
}
