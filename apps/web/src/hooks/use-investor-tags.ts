"use client";

import { useCallback, useEffect, useState } from "react";

import type { BadgeVariant } from "@/components/shared/badge";
import {
  INVESTOR_TAG_UNTAGGED,
  type InvestorTag,
  listInvestorTags,
} from "@/services/investor-tag.service";

/**
 * Module-level cache mirroring useBusinessUnits. The tag list is tiny and
 * rarely changes, so one fetch serves every consumer — chips on rows, the
 * list filter, the form multi-select and the manager dialog — without a
 * request per mount.
 */
let cachedTags: InvestorTag[] | null = null;
let pendingFetch: Promise<InvestorTag[]> | null = null;

async function fetchActiveTags(): Promise<InvestorTag[]> {
  if (cachedTags) return cachedTags;
  if (pendingFetch) return pendingFetch;
  pendingFetch = listInvestorTags({ includeInactive: false })
    .then((res) => {
      cachedTags = res.data;
      return res.data;
    })
    .finally(() => {
      pendingFetch = null;
    });
  return pendingFetch;
}

export function invalidateInvestorTagCache() {
  cachedTags = null;
  pendingFetch = null;
}

interface UseInvestorTagsOptions {
  includeInactive?: boolean;
}

export function useInvestorTags(options: UseInvestorTagsOptions = {}) {
  const { includeInactive = false } = options;
  const [tags, setTags] = useState<InvestorTag[]>(
    !includeInactive && cachedTags ? cachedTags : [],
  );
  const [loading, setLoading] = useState(!(!includeInactive && cachedTags));

  const load = useCallback(() => {
    setLoading(true);
    return (
      includeInactive
        ? listInvestorTags({ includeInactive: true }).then((r) => r.data)
        : fetchActiveTags()
    )
      .then((rows) => rows)
      .catch(() => {
        // Fail soft: an empty list hides the filter and chips rather than
        // breaking the investors table.
        return [] as InvestorTag[];
      })
      .finally(() => setLoading(false));
  }, [includeInactive]);

  useEffect(() => {
    let cancelled = false;
    void load().then((rows) => {
      if (!cancelled) setTags(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  /** Re-fetch after a mutation in the manager dialog. */
  const refresh = useCallback(async () => {
    invalidateInvestorTagCache();
    const rows = await load();
    setTags(rows);
    return rows;
  }, [load]);

  return { tags, loading, refresh };
}

/**
 * Label for a code. Falls back to the raw code when the cache has not loaded
 * yet or the tag has since been deleted — an investor can outlive its tag if
 * the row was orphaned rather than stripped.
 */
export function labelForInvestorTag(code: string): string {
  if (code === INVESTOR_TAG_UNTAGGED) return "Untagged";
  if (!cachedTags) return code;
  return cachedTags.find((t) => t.code === code)?.label ?? code;
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
export function variantForInvestorTag(code: string): BadgeVariant {
  const stored = cachedTags?.find((t) => t.code === code)?.color;
  return KNOWN_VARIANTS.find((v) => v === stored) ?? "grey";
}
