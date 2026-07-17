"use client";

import { type SetStateAction, useCallback, useMemo, useState } from "react";

export interface UsePaginationOptions {
  initialPage?: number;
  initialPageSize?: number;
  initialTotal?: number;
}

export interface UsePaginationResult {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  setTotalCount: (value: SetStateAction<number>) => void;
  reset: () => void;
}

/**
 * Lightweight pagination state hook used together with `<DataPagination />`.
 * Page is 1-indexed.
 */
export function usePagination({
  initialPage = 1,
  initialPageSize = 10,
  initialTotal = 0,
}: UsePaginationOptions = {}): UsePaginationResult {
  const [page, setPageState] = useState(initialPage);
  const [pageSize, setPageSizeState] = useState(initialPageSize);
  const [totalCount, setTotalCountState] = useState(initialTotal);

  const setTotalCount = useCallback((value: SetStateAction<number>) => {
    setTotalCountState((prev) =>
      typeof value === "function" ? value(prev) : value,
    );
  }, []);

  const totalPages = useMemo(
    () => (pageSize > 0 ? Math.max(1, Math.ceil(totalCount / pageSize)) : 1),
    [totalCount, pageSize],
  );

  const setPage = useCallback(
    (next: number) => {
      const clamped = Math.min(Math.max(1, next), totalPages);
      setPageState(clamped);
    },
    [totalPages],
  );

  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size);
    setPageState(1);
  }, []);

  const reset = useCallback(() => {
    setPageState(initialPage);
    setPageSizeState(initialPageSize);
    setTotalCount(initialTotal);
  }, [initialPage, initialPageSize, initialTotal, setTotalCount]);

  return {
    page,
    pageSize,
    totalCount,
    totalPages,
    setPage,
    setPageSize,
    setTotalCount,
    reset,
  };
}
