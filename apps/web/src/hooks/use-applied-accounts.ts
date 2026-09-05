"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  persistAccounts,
  readPersistedAccounts,
} from "@/hooks/use-filter-persistence";

/**
 * The set of accounts a dashboard totals, edited freely but only reaching the
 * data layer on an explicit Apply.
 *
 * Same reasoning as {@link useAppliedDateRange}: narrowing the set is a server
 * round trip (the totals are computed by the metrics engine, not summed in the
 * browser), so ticking five boxes should cost one request rather than five.
 *
 * `null` means "every account" rather than an enumerated list of all of them.
 * That distinction matters on first paint: the page does not know which
 * accounts exist until the payload arrives, so it cannot enumerate them in the
 * request that fetches them. `null` also keeps the URL and the request clean
 * while nothing is narrowed, and lets the API apply its own default.
 */
export interface AppliedAccounts {
  /** Bind the checkboxes to this. `null` = every account. */
  draft: string[] | null;
  /** Build the request from this. `null` = send no `accounts` param. */
  applied: string[] | null;
  /** Nothing is narrowed — every account counts. */
  isAll: boolean;
  /** Draft differs from what is applied, so Apply would change the data. */
  dirty: boolean;
  /**
   * Whether a persisted selection has been looked for yet. Always true when
   * nothing is being persisted. See the note on {@link AppliedDateRange.hydrated}
   * — callers must hold their first fetch until this flips, or they fetch the
   * default set and then immediately fetch the restored one.
   */
  hydrated: boolean;
  /**
   * Add or remove one account. `allKeys` is needed to recognise the moment a
   * selection becomes complete, which collapses back to `null` — otherwise
   * re-checking the last box would leave an enumerated list that means "all"
   * but does not look like it.
   *
   * Removing the last remaining account is refused: a total over no accounts is
   * not a number the page can show, and the API rejects an empty list.
   */
  toggle: (key: string, allKeys: string[]) => void;
  /** Back to every account, still behind Apply. */
  selectAll: () => void;
  /** Narrow to exactly one account, still behind Apply. */
  selectOnly: (key: string) => void;
  apply: () => void;
  /** Back to every account, applied immediately. */
  reset: () => void;
}

/** Order-insensitive comparison — the request is a set, not a sequence. */
function sameSet(a: string[] | null, b: string[] | null): boolean {
  if (a === null || b === null) return a === b;
  if (a.length !== b.length) return false;
  const sortedB = [...b].sort();
  return [...a].sort().every((key, i) => key === sortedB[i]);
}

export function useAppliedAccounts(
  /**
   * Pass a key to remember the applied selection between visits (localStorage
   * plus `?accounts=`). Omit it and the hook behaves exactly as before.
   */
  storageKey?: string,
): AppliedAccounts {
  const [draft, setDraft] = useState<string[] | null>(null);
  const [applied, setApplied] = useState<string[] | null>(null);
  const [hydrated, setHydrated] = useState(!storageKey);

  useEffect(() => {
    if (!storageKey) return;
    const restored = readPersistedAccounts(storageKey);
    // Null means "every account", which is already the initial state — so only
    // a real narrowing is worth applying, and "all" persists as absence.
    if (restored) {
      setDraft(restored);
      setApplied(restored);
    }
    setHydrated(true);
  }, [storageKey]);

  const toggle = useCallback((key: string, allKeys: string[]) => {
    setDraft((current) => {
      const selected = current ?? allKeys;
      if (selected.includes(key)) {
        const next = selected.filter((k) => k !== key);
        return next.length === 0 ? selected : next;
      }
      const next = [...selected, key];
      // Complete again → back to the "all" shape rather than a list that
      // happens to name everything.
      return next.length >= allKeys.length &&
        allKeys.every((k) => next.includes(k))
        ? null
        : next;
    });
  }, []);

  const selectAll = useCallback(() => setDraft(null), []);
  const selectOnly = useCallback((key: string) => setDraft([key]), []);
  const apply = useCallback(() => {
    setApplied(draft);
    if (storageKey) persistAccounts(storageKey, draft);
  }, [draft, storageKey]);

  // Reset applies itself: it is an explicit action, so leaving the cleared
  // selection sitting unapplied behind the button just pressed would read as
  // the reset having failed.
  const reset = useCallback(() => {
    setDraft(null);
    setApplied(null);
    // Clearing what is remembered is part of resetting — otherwise the next
    // visit restores the selection the reader just cleared.
    if (storageKey) persistAccounts(storageKey, null);
  }, [storageKey]);

  return useMemo(
    () => ({
      draft,
      applied,
      isAll: draft === null,
      dirty: !sameSet(draft, applied),
      hydrated,
      toggle,
      selectAll,
      selectOnly,
      apply,
      reset,
    }),
    [draft, applied, hydrated, toggle, selectAll, selectOnly, apply, reset],
  );
}
