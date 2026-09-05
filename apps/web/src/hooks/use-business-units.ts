"use client";

import { useEffect, useState } from "react";

import type { BadgeVariant } from "@/components/shared/badge";
import {
  BUSINESS_UNIT_UNASSIGNED,
  type BusinessUnit,
  listBusinessUnits,
} from "@/services/crm-business-unit.service";

/**
 * Module-level cache mirroring useLostReasons. The unit list is tiny and
 * rarely changes, so one fetch serves every consumer — chips on cards, the
 * pipeline filter, the form multi-selects, and the sidebar's per-unit views
 * — without a request per mount.
 */
let cachedUnits: BusinessUnit[] | null = null;
let pendingFetch: Promise<BusinessUnit[]> | null = null;

async function fetchActiveUnits(): Promise<BusinessUnit[]> {
  if (cachedUnits) return cachedUnits;
  if (pendingFetch) return pendingFetch;
  pendingFetch = listBusinessUnits({ includeInactive: false })
    .then((res) => {
      cachedUnits = res.data;
      return res.data;
    })
    .finally(() => {
      pendingFetch = null;
    });
  return pendingFetch;
}

export function invalidateBusinessUnitCache() {
  cachedUnits = null;
  pendingFetch = null;
}

interface UseBusinessUnitsOptions {
  includeInactive?: boolean;
}

export function useBusinessUnits(options: UseBusinessUnitsOptions = {}) {
  const { includeInactive = false } = options;
  const [units, setUnits] = useState<BusinessUnit[]>(
    !includeInactive && cachedUnits ? cachedUnits : [],
  );
  const [loading, setLoading] = useState(!(!includeInactive && cachedUnits));

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const promise = includeInactive
      ? listBusinessUnits({ includeInactive: true }).then((r) => r.data)
      : fetchActiveUnits();

    promise
      .then((rows) => {
        if (cancelled) return;
        setUnits(rows);
      })
      .catch(() => {
        // Fail soft: an empty list hides the filter/chips rather than
        // breaking the board.
        if (cancelled) return;
        setUnits([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [includeInactive]);

  return { units, loading };
}

/**
 * Label for a code. Falls back to the raw code when the cache hasn't loaded
 * yet or the unit has since been deleted — a record can outlive its tag.
 */
export function labelForBusinessUnitCode(code: string): string {
  // The "no units" sentinel is not a real unit and never has a catalog row,
  // so the raw-code fallback below would surface `__none__` verbatim. The
  // per-business-unit board renders one card per (deal x unit) and gives an
  // untagged deal a single card carrying this sentinel, so it reaches a chip
  // on every untagged deal.
  if (code === BUSINESS_UNIT_UNASSIGNED) return "Unassigned";
  if (!cachedUnits) return code;
  // A code whose unit an admin deleted still renders, as its raw code,
  // rather than vanishing — that one IS a real code and worth showing.
  return cachedUnits.find((u) => u.code === code)?.label ?? code;
}

const KNOWN_VARIANTS: BadgeVariant[] = [
  "green",
  "amber",
  "red",
  "gold",
  "blue",
  "grey",
  "purple",
  "teal",
  "violet",
];

/**
 * Chip colour for a code. The stored `color` is a Badge variant NAME, so the
 * class strings stay in Badge's literal VARIANT_STYLES map and survive
 * Tailwind's static scan (CLAUDE.md). Anything unrecognised → grey.
 */
export function variantForBusinessUnitCode(code: string): BadgeVariant {
  const stored = cachedUnits?.find((u) => u.code === code)?.color;
  return KNOWN_VARIANTS.find((v) => v === stored) ?? "grey";
}
