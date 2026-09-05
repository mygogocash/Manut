"use client";

import { useCallback, useEffect, useState } from "react";

import {
  persistRange,
  readPersistedRange,
} from "@/hooks/use-filter-persistence";

/**
 * A date range the pickers edit freely but that only reaches the data layer on
 * an explicit Apply.
 *
 * Fetching straight off the pickers means choosing FROM fires a request
 * immediately, for a range the user has not finished expressing: one wasted
 * round trip per edit, and a page that redraws with numbers for a window
 * nobody asked for on the way to the one they wanted. On the DAU/MAU dashboard
 * each of those is a 120-day BNII query.
 *
 * `applied*` is what callers should feed their fetch; `draft*` is what the
 * inputs bind to. They are separate pieces of state rather than one value plus
 * a pending flag, because the difference between them IS the thing the UI has
 * to show — "Showing X → Y" must keep reporting the window the data on screen
 * came from while the pickers already say something else.
 */
export interface AppliedDateRange {
  /** Bind the inputs to these. */
  draftFrom: string;
  draftTo: string;
  /** Build the request from these. Empty means "let the API decide". */
  appliedFrom: string;
  appliedTo: string;
  setDraftFrom: (value: string) => void;
  setDraftTo: (value: string) => void;
  /** Draft differs from what is applied — Apply would change the data. */
  dirty: boolean;
  /** Either side of either range is set, so Reset has something to clear. */
  isSet: boolean;
  /**
   * Whether a persisted range has been looked for yet.
   *
   * Always true when nothing is being persisted. When it IS, callers must hold
   * their first fetch until this flips: the stored range can only be read in an
   * effect (window is not available during render, and reading it there would
   * be a hydration mismatch), so a fetch fired on the first commit would ask for
   * the DEFAULT window and then immediately ask again for the restored one —
   * two 120-day BNII queries to show one screen, and a flash of numbers for a
   * window nobody chose.
   */
  hydrated: boolean;
  apply: () => void;
  reset: () => void;
  /**
   * Set draft and applied together, for a range the user picked in one gesture
   * rather than typed — a "Last 30 days" preset, say. Such a choice is already
   * deliberate, so making it wait behind Apply would be friction, and leaving
   * the inputs showing the previous custom dates while the chart moved would
   * be worse than friction.
   *
   * This exists because `setDraftFrom(...)` followed by `apply()` in one
   * handler applies the PREVIOUS draft: `apply` closes over the render's
   * state, which the setters have not updated yet.
   */
  setRange: (from: string, to: string) => void;
}

export function useAppliedDateRange(
  initialFrom = "",
  initialTo = "",
  /**
   * Pass a key to remember the applied range between visits (localStorage plus
   * `?from=`/`?to=`). Omit it and the hook behaves exactly as before.
   */
  storageKey?: string,
): AppliedDateRange {
  const [draftFrom, setDraftFrom] = useState(initialFrom);
  const [draftTo, setDraftTo] = useState(initialTo);
  const [appliedFrom, setAppliedFrom] = useState(initialFrom);
  const [appliedTo, setAppliedTo] = useState(initialTo);
  const [hydrated, setHydrated] = useState(!storageKey);

  useEffect(() => {
    if (!storageKey) return;
    const restored = readPersistedRange(storageKey);
    if (restored) {
      // Draft and applied together: a restored range is already a decision the
      // reader made, so leaving it sitting behind Apply would make the page
      // show one window while the pickers claimed another.
      setDraftFrom(restored.from);
      setDraftTo(restored.to);
      setAppliedFrom(restored.from);
      setAppliedTo(restored.to);
    }
    setHydrated(true);
  }, [storageKey]);

  const apply = useCallback(() => {
    setAppliedFrom(draftFrom);
    setAppliedTo(draftTo);
    if (storageKey) persistRange(storageKey, { from: draftFrom, to: draftTo });
  }, [draftFrom, draftTo, storageKey]);

  // Reset applies itself. It is an explicit action, so leaving the cleared
  // range sitting unapplied behind a button the user just pressed would read
  // as the reset having failed.
  const reset = useCallback(() => {
    setDraftFrom("");
    setDraftTo("");
    setAppliedFrom("");
    setAppliedTo("");
    // Clearing what is remembered is part of resetting. Leaving it would undo
    // the reset on the reader's next visit.
    if (storageKey) persistRange(storageKey, { from: "", to: "" });
  }, [storageKey]);

  const setRange = useCallback(
    (from: string, to: string) => {
      setDraftFrom(from);
      setDraftTo(to);
      setAppliedFrom(from);
      setAppliedTo(to);
      if (storageKey) persistRange(storageKey, { from, to });
    },
    [storageKey],
  );

  return {
    draftFrom,
    draftTo,
    appliedFrom,
    appliedTo,
    setDraftFrom,
    setDraftTo,
    dirty: draftFrom !== appliedFrom || draftTo !== appliedTo,
    isSet: Boolean(draftFrom || draftTo || appliedFrom || appliedTo),
    hydrated,
    apply,
    reset,
    setRange,
  };
}
