"use client";

import { useEffect, useState } from "react";

import {
  listLostReasons,
  type LostReason,
} from "@/services/revenue-lost-reason.service";

// Module-level cache mirroring useLeadSources. Lost reasons are tiny
// and rarely change, so the same list serves every consumer (close-lost
// dialog, opportunity detail sheet) without re-fetching per mount.
let cachedReasons: LostReason[] | null = null;
let pendingFetch: Promise<LostReason[]> | null = null;

async function fetchActiveReasons(): Promise<LostReason[]> {
  if (cachedReasons) return cachedReasons;
  if (pendingFetch) return pendingFetch;
  pendingFetch = listLostReasons({ includeInactive: false })
    .then((res) => {
      cachedReasons = res.data;
      return res.data;
    })
    .finally(() => {
      pendingFetch = null;
    });
  return pendingFetch;
}

export function invalidateLostReasonCache() {
  cachedReasons = null;
  pendingFetch = null;
}

interface UseLostReasonsOptions {
  includeInactive?: boolean;
}

export function useLostReasons(options: UseLostReasonsOptions = {}) {
  const { includeInactive = false } = options;
  const [reasons, setReasons] = useState<LostReason[]>(
    !includeInactive && cachedReasons ? cachedReasons : [],
  );
  const [loading, setLoading] = useState(!(!includeInactive && cachedReasons));

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const promise = includeInactive
      ? listLostReasons({ includeInactive: true }).then((r) => r.data)
      : fetchActiveReasons();

    promise
      .then((rows) => {
        if (cancelled) return;
        setReasons(rows);
      })
      .catch(() => {
        if (cancelled) return;
        setReasons([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [includeInactive]);

  return { reasons, loading };
}

// Returns the cached label for a code; falls back to the raw code when
// the cache hasn't loaded yet or the code is no longer active.
export function labelForLostReasonCode(code: string): string {
  if (!cachedReasons) return code;
  return cachedReasons.find((r) => r.code === code)?.label ?? code;
}
