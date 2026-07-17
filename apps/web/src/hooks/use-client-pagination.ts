"use client";

import { useEffect, useMemo } from "react";

import {
  usePagination,
  type UsePaginationResult,
} from "@/hooks/use-pagination";

export interface UseClientPaginationResult<T> extends UsePaginationResult {
  pageItems: T[];
}

/**
 * Client-side pagination for in-memory arrays. Wraps `usePagination` and
 * automatically syncs `totalCount` whenever the source array changes.
 *
 * Use this when the entire dataset is already available client-side (e.g. mock
 * data, fully fetched lists). For server-paginated endpoints use
 * `usePagination` directly and pass the meta `total` from the API.
 */
export function useClientPagination<T>(
  items: T[],
  initialPageSize = 10,
): UseClientPaginationResult<T> {
  const pagination = usePagination({
    initialPageSize,
    initialTotal: items.length,
  });

  const { page, pageSize, setTotalCount } = pagination;

  useEffect(() => {
    setTotalCount(items.length);
  }, [items.length, setTotalCount]);

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  return { ...pagination, pageItems };
}
