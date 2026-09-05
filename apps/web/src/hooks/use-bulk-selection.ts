"use client";

import { useCallback, useMemo, useState } from "react";

/**
 * Selection state for a Sales CRM bulk action.
 *
 * Two modes, matching the API:
 *
 *   * ticked ids — the rows the user can see and chose;
 *   * `allMatching` — "select all N matching the current filters", where the
 *     server resolves N through the same where-builder the list uses.
 *
 * `total` is the server-reported count for the current filters and is passed
 * IN, never derived from the loaded rows. A kanban column or a table page holds
 * one page; computing a total from what happens to be in memory is a documented
 * repo pitfall and would understate "select all N" badly.
 */
export interface BulkSelection {
  /** Ticked ids, empty when `allMatching` is on. */
  ids: string[];
  /** True once the user escalates to "everything matching the filter". */
  allMatching: boolean;
  /** How many records the action will touch, for the bar's label. */
  count: number;
  /** Any selection at all? Drives whether the action bar is shown. */
  active: boolean;
  isSelected: (id: string) => boolean;
  toggle: (id: string) => void;
  /** Tick/untick a whole visible group — a kanban column, or a table page. */
  toggleMany: (ids: string[], next: boolean) => void;
  /**
   * Adopt a selection computed elsewhere — used by `DataTable`, which owns its
   * own checkbox state and hands back the whole Set.
   */
  replaceIds: (ids: string[]) => void;
  selectAllMatching: () => void;
  clear: () => void;
}

export function useBulkSelection(total: number): BulkSelection {
  const [ids, setIds] = useState<string[]>([]);
  const [allMatching, setAllMatching] = useState(false);

  const idSet = useMemo(() => new Set(ids), [ids]);

  const toggle = useCallback((id: string) => {
    // Ticking a row after "select all matching" drops back to an explicit
    // selection — otherwise the bar would claim N while the user is clearly
    // curating a smaller set.
    setAllMatching(false);
    setIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  const toggleMany = useCallback((groupIds: string[], next: boolean) => {
    setAllMatching(false);
    setIds((prev) => {
      if (next) {
        const merged = new Set(prev);
        groupIds.forEach((id) => merged.add(id));
        return [...merged];
      }
      const removing = new Set(groupIds);
      return prev.filter((id) => !removing.has(id));
    });
  }, []);

  const replaceIds = useCallback((nextIds: string[]) => {
    setAllMatching(false);
    setIds(nextIds);
  }, []);

  const selectAllMatching = useCallback(() => {
    setAllMatching(true);
    // Drop the explicit ids so the payload carries exactly one mode. The API
    // ignores ids when allMatching is set, but sending both invites confusion
    // the next time somebody reads a request log.
    setIds([]);
  }, []);

  const clear = useCallback(() => {
    setAllMatching(false);
    setIds([]);
  }, []);

  return {
    ids,
    allMatching,
    count: allMatching ? total : ids.length,
    active: allMatching || ids.length > 0,
    isSelected: useCallback((id: string) => idSet.has(id), [idSet]),
    toggle,
    toggleMany,
    replaceIds,
    selectAllMatching,
    clear,
  };
}
