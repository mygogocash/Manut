"use client";

import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
} from "lucide-react";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface DataPaginationProps {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  pageSizeOptions?: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  className?: string;
  showPageSizeSelector?: boolean;
  showRangeLabel?: boolean;
}

const DEFAULT_PAGE_SIZES = [10, 20, 50, 100];

function buildPageList(current: number, total: number): (number | "…")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | "…")[] = [1];
  const left = Math.max(2, current - 1);
  const right = Math.min(total - 1, current + 1);

  if (left > 2) pages.push("…");
  for (let i = left; i <= right; i++) pages.push(i);
  if (right < total - 1) pages.push("…");

  pages.push(total);
  return pages;
}

export function DataPagination({
  page,
  pageSize,
  totalCount,
  totalPages,
  pageSizeOptions = DEFAULT_PAGE_SIZES,
  onPageChange,
  onPageSizeChange,
  className,
  showPageSizeSelector = true,
  showRangeLabel = true,
}: DataPaginationProps) {
  const pages = useMemo(
    () => buildPageList(page, totalPages),
    [page, totalPages],
  );

  const startItem = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, totalCount);

  const isFirst = page <= 1;
  const isLast = page >= totalPages;

  return (
    <div
      className={cn(
        `
          flex flex-col items-center justify-between gap-3 px-1 py-2 text-xs
          sm:flex-row
        `,
        className,
      )}
    >
      <div className="text-muted-foreground flex items-center gap-3">
        {showRangeLabel && (
          <p>
            Showing{" "}
            <span className="text-foreground font-medium tabular-nums">
              {startItem}–{endItem}
            </span>{" "}
            of{" "}
            <span className="text-foreground font-medium tabular-nums">
              {totalCount}
            </span>
          </p>
        )}
        {showPageSizeSelector && onPageSizeChange && (
          <div className="flex items-center gap-1.5">
            <span>Rows</span>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => onPageSizeChange(Number(value))}
            >
              <SelectTrigger className="h-7 w-16 text-xs" aria-label="Rows per page">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                {pageSizeOptions.map((size) => (
                  <SelectItem
                    key={size}
                    value={String(size)}
                    className="text-xs"
                  >
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onPageChange(1)}
          disabled={isFirst}
          aria-label="First page"
        >
          <ChevronsLeftIcon className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onPageChange(page - 1)}
          disabled={isFirst}
          aria-label="Previous page"
        >
          <ChevronLeftIcon className="size-4" />
        </Button>

        <div className="flex items-center gap-0.5">
          {pages.map((p, idx) =>
            p === "…" ? (
              <span
                key={`ellipsis-${idx}`}
                className="text-muted-foreground px-1.5 text-xs"
              >
                …
              </span>
            ) : (
              <Button
                key={p}
                variant={p === page ? "outline" : "ghost"}
                className={cn(
                  "h-7 min-w-7 px-2 text-xs tabular-nums",
                  p === page && "border-primary/40 text-foreground font-medium",
                )}
                onClick={() => onPageChange(p)}
                aria-current={p === page ? "page" : undefined}
              >
                {p}
              </Button>
            ),
          )}
        </div>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onPageChange(page + 1)}
          disabled={isLast}
          aria-label="Next page"
        >
          <ChevronRightIcon className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onPageChange(totalPages)}
          disabled={isLast}
          aria-label="Last page"
        >
          <ChevronsRightIcon className="size-4" />
        </Button>
      </div>
    </div>
  );
}
