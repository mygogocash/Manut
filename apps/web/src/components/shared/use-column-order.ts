"use client";

import { arrayMove } from "@dnd-kit/sortable";
import { useCallback, useEffect, useState } from "react";

// Shared column-order state for CRM list tables. Each table passes a
// stable storageKey + its default key order; the hook persists user
// reordering in localStorage and tolerates schema drift (unknown keys
// dropped, newly-added default keys appended). Mirrors the original
// inline implementations in it-crm-list / voucher-crm-list (#665 era).
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
      const filtered = parsed.filter((k): k is K =>
        defaultOrder.includes(k as K),
      );
      const missing = defaultOrder.filter((k) => !filtered.includes(k));
      setColOrder([...filtered, ...missing]);
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
