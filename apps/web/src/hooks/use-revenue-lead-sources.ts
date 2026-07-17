"use client";

import { useEffect, useState } from "react";

import {
  type LeadSource,
  listLeadSources,
} from "@/services/revenue-lead-source.service";

// Module-level cache: lead-source rows are tiny (<10 normally) and rarely
// change, so the same list can serve every consumer (lead form, leads
// tab filter, detail sheet) without re-fetching per mount. The cache
// resets when the page reloads or when admin CRUD operations call
// invalidateLeadSourceCache().
let cachedSources: LeadSource[] | null = null;
let pendingFetch: Promise<LeadSource[]> | null = null;

async function fetchActiveSources(): Promise<LeadSource[]> {
  if (cachedSources) return cachedSources;
  if (pendingFetch) return pendingFetch;
  pendingFetch = listLeadSources({ includeInactive: false })
    .then((res) => {
      cachedSources = res.data;
      return res.data;
    })
    .finally(() => {
      pendingFetch = null;
    });
  return pendingFetch;
}

export function invalidateLeadSourceCache() {
  cachedSources = null;
  pendingFetch = null;
}

interface UseLeadSourcesOptions {
  // Admins managing the workspace need deactivated rows too. Reps don't,
  // so the default omits them and shares the module-level cache.
  includeInactive?: boolean;
}

export function useLeadSources(options: UseLeadSourcesOptions = {}) {
  const { includeInactive = false } = options;
  const [sources, setSources] = useState<LeadSource[]>(
    !includeInactive && cachedSources ? cachedSources : [],
  );
  const [loading, setLoading] = useState(!(!includeInactive && cachedSources));

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const promise = includeInactive
      ? listLeadSources({ includeInactive: true }).then((r) => r.data)
      : fetchActiveSources();

    promise
      .then((rows) => {
        if (cancelled) return;
        setSources(rows);
      })
      .catch(() => {
        if (cancelled) return;
        setSources([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [includeInactive]);

  return { sources, loading };
}

// Convenience helper for legacy code-only labelling: returns the cached
// label or the raw code when the cache hasn't loaded yet.
export function labelForSourceCode(code: string): string {
  if (!cachedSources) return code;
  return cachedSources.find((s) => s.code === code)?.label ?? code;
}
