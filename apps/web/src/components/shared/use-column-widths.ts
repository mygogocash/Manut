"use client";

import { useCallback, useEffect, useState } from "react";

// Smallest a column may be dragged to. Keeps a column from collapsing
// to an unclickable sliver.
export const MIN_COLUMN_WIDTH = 56;

// Per-column pixel widths for CRM list tables, persisted to
// localStorage. Pairs with a `table-fixed` layout so the widths are
// authoritative (Notion-style drag-to-resize). Unknown / non-positive
// stored values are ignored, and any default key missing from storage
// keeps its default — so the width schema can evolve safely.
export function useColumnWidths<K extends string>(
  storageKey: string,
  defaults: Record<K, number>,
) {
  const [widths, setWidths] = useState<Record<K, number>>(() => ({
    ...defaults,
  }));

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== "object") return;
      const merged = { ...defaults };
      for (const key of Object.keys(defaults) as K[]) {
        const v = (parsed as Record<string, unknown>)[key];
        if (
          typeof v === "number" &&
          Number.isFinite(v) &&
          v >= MIN_COLUMN_WIDTH
        ) {
          merged[key] = Math.round(v);
        }
      }
      setWidths(merged);
    } catch {
      // corrupt storage — keep defaults
    }
    // defaults is expected to be a module-level constant (stable ref)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // Live + persisted in one call. Resize fires this on every pointer
  // move; localStorage writes are cheap and keep state crash-safe.
  const setWidth = useCallback(
    (key: K, width: number) => {
      setWidths((prev) => {
        const next = {
          ...prev,
          [key]: Math.max(MIN_COLUMN_WIDTH, Math.round(width)),
        };
        if (typeof window !== "undefined") {
          try {
            window.localStorage.setItem(storageKey, JSON.stringify(next));
          } catch {
            // ignore quota / disabled storage
          }
        }
        return next;
      });
    },
    [storageKey],
  );

  return { widths, setWidth };
}
