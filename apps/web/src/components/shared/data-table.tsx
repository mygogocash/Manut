"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface Column<T> {
  key: string;
  header: string;
  render?: (item: T, index: number) => React.ReactNode;
  className?: string;
  /** When true, the header is rendered as a button that calls `onSortChange(key)`. */
  sortable?: boolean;
}

export type SortOrder = "asc" | "desc";

function defaultGetRowId<T>(item: T, index: number): string {
  if (item !== null && typeof item === "object" && "id" in item) {
    const id = (item as { id: unknown }).id;
    if (id !== undefined && id !== null && String(id) !== "") {
      return String(id);
    }
  }
  return `__index_${index}`;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  className?: string;
  title?: string;
  actions?: React.ReactNode;
  loading?: boolean;
  pagination?: React.ReactNode;
  /** Supabase-style row checkboxes. Default: false */
  enableRowSelection?: boolean;
  getRowId?: (item: T, index: number) => string;
  selectedRowIds?: Set<string>;
  onSelectedRowIdsChange?: (ids: Set<string>) => void;
  /** Shown in the selection bar when at least one row is selected */
  selectionActions?: React.ReactNode;
  /** Placeholder rows while `loading` is true. Default: 10 */
  skeletonRows?: number;
  /** Currently active sort key. Header arrow appears on the matching column. */
  sortBy?: string;
  sortOrder?: SortOrder;
  /** Called when a sortable header is clicked. Receives the column key. */
  onSortChange?: (key: string) => void;
  /**
   * Optional per-row className helper. Merged after the default row styles
   * so callers can override borders, background, etc. — handy for visual
   * grouping (e.g. a thicker top border on the first row of each group).
   */
  getRowClassName?: (item: T, index: number) => string | undefined;
  /**
   * Optional `<tfoot>` content rendered below the body. Callers pass
   * raw `<TableRow>` markup (use the same `Table*` primitives) so the
   * footer can show column sums, group totals, etc. without breaking
   * the table's column-width alignment.
   */
  footer?: React.ReactNode;
}

const SKELETON_BAR_WIDTHS = [
  "max-w-[42%]",
  "max-w-[72%]",
  "max-w-[58%]",
  "max-w-[88%]",
  "max-w-[36%]",
  "max-w-[66%]",
  "max-w-[51%]",
  "max-w-[79%]",
  "max-w-[44%]",
  "max-w-[62%]",
] as const;

/** Marks body rows so we only run `onRowClick` when the same gesture started inside this row (avoids Radix menu portal “ghost clicks”). */
const ROW_CLICK_SURFACE = "data-datatable-row-surface";

export function DataTable<T>({
  columns,
  data,
  onRowClick,
  emptyMessage = "No data found",
  className,
  title,
  actions,
  loading,
  pagination,
  enableRowSelection = false,
  getRowId: getRowIdProp,
  selectedRowIds: selectedRowIdsProp,
  onSelectedRowIdsChange,
  selectionActions,
  skeletonRows = 10,
  sortBy,
  sortOrder,
  onSortChange,
  getRowClassName,
  footer,
}: DataTableProps<T>) {
  const getRowId = getRowIdProp ?? defaultGetRowId;
  const rowClickInstanceId = React.useId();
  const pointerDownSurfaceRef = React.useRef<string | null>(null);

  React.useLayoutEffect(() => {
    if (!onRowClick) return;
    /** `mousedown` covers jsdom / fireEvent; `pointerdown` covers real pointers + touch. */
    const onDownCapture = (e: Event) => {
      const raw = e.target;
      const t =
        raw instanceof Element
          ? raw
          : raw instanceof Text && raw.parentElement
            ? raw.parentElement
            : null;
      if (!t) {
        pointerDownSurfaceRef.current = null;
        return;
      }
      const row = t.closest(`tr[${ROW_CLICK_SURFACE}]`);
      pointerDownSurfaceRef.current =
        row?.getAttribute(ROW_CLICK_SURFACE) ?? null;
    };
    document.addEventListener("pointerdown", onDownCapture, true);
    document.addEventListener("mousedown", onDownCapture, true);
    return () => {
      document.removeEventListener("pointerdown", onDownCapture, true);
      document.removeEventListener("mousedown", onDownCapture, true);
    };
  }, [onRowClick]);

  const isControlled = selectedRowIdsProp !== undefined;
  const [internalIds, setInternalIds] = React.useState(() => new Set<string>());
  const selectedIds = isControlled ? selectedRowIdsProp! : internalIds;

  const updateSelection = React.useCallback(
    (updater: (prev: Set<string>) => Set<string>) => {
      const base = new Set(isControlled ? selectedRowIdsProp! : internalIds);
      const next = updater(base);
      if (!isControlled) setInternalIds(next);
      onSelectedRowIdsChange?.(next);
    },
    [isControlled, selectedRowIdsProp, internalIds, onSelectedRowIdsChange],
  );

  const clearSelection = React.useCallback(() => {
    updateSelection(() => new Set());
  }, [updateSelection]);

  const visibleRowMeta = React.useMemo(
    () =>
      data.map((item, index) => ({
        item,
        index,
        id: getRowId(item, index),
      })),
    [data, getRowId],
  );

  const visibleIds = React.useMemo(
    () => visibleRowMeta.map((r) => r.id),
    [visibleRowMeta],
  );

  const selectedOnPageCount = React.useMemo(
    () => visibleIds.filter((id) => selectedIds.has(id)).length,
    [visibleIds, selectedIds],
  );

  const allVisibleSelected =
    visibleIds.length > 0 && selectedOnPageCount === visibleIds.length;
  const someVisibleSelected =
    selectedOnPageCount > 0 && selectedOnPageCount < visibleIds.length;

  const headerCheckboxChecked = allVisibleSelected
    ? true
    : someVisibleSelected
      ? "indeterminate"
      : false;

  const toggleAllVisible = React.useCallback(() => {
    updateSelection((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const id of visibleIds) next.delete(id);
      } else {
        for (const id of visibleIds) next.add(id);
      }
      return next;
    });
  }, [allVisibleSelected, updateSelection, visibleIds]);

  const toggleRow = React.useCallback(
    (rowId: string) => {
      updateSelection((prev) => {
        const next = new Set(prev);
        if (next.has(rowId)) next.delete(rowId);
        else next.add(rowId);
        return next;
      });
    },
    [updateSelection],
  );

  const selectedCount = selectedIds.size;
  const showSelectionBar =
    enableRowSelection && !loading && selectedCount > 0 && data.length > 0;

  const colSpan = enableRowSelection ? columns.length + 1 : columns.length;

  return (
    <div
      className={cn(
        "border-border bg-surface overflow-hidden rounded-lg border",
        "shadow-sm",
        className,
      )}
    >
      {(title || actions) && (
        <div
          className={`
            border-border flex items-center justify-between border-b px-4 py-3
          `}
        >
          {title && (
            <h3
              className={`
                text-muted-foreground text-[9.5px] font-bold tracking-widest
                uppercase
              `}
            >
              {title}
            </h3>
          )}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}

      {showSelectionBar && (
        <div
          className={cn(
            "border-border flex flex-wrap items-center justify-between gap-2",
            "bg-primary/5 border-b px-3 py-2",
          )}
        >
          <p className="text-muted-foreground text-xs tabular-nums">
            <span className="text-foreground font-medium">{selectedCount}</span>{" "}
            {selectedCount === 1 ? "row selected" : "rows selected"}
          </p>
          <div className="flex items-center gap-1.5">
            {selectionActions}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground h-7 px-2 text-xs"
              onClick={clearSelection}
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow
            className={`
              border-border bg-surface-secondary border-b
              hover:bg-transparent
            `}
          >
            {enableRowSelection && (
              <TableHead
                className={cn(
                  "text-muted-foreground w-10 max-w-10 min-w-10 px-2 py-2.5",
                )}
              >
                <div
                  className="flex justify-center"
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <Checkbox
                    disabled={loading || visibleIds.length === 0}
                    checked={headerCheckboxChecked}
                    onCheckedChange={() => toggleAllVisible()}
                    aria-label="Select all rows on this page"
                  />
                </div>
              </TableHead>
            )}
            {columns.map((col) => {
              const isSortable = Boolean(col.sortable && onSortChange);
              const isSortedBy = isSortable && sortBy === col.key;
              const SortIcon = !isSortable
                ? null
                : isSortedBy
                  ? sortOrder === "desc"
                    ? ArrowDown
                    : ArrowUp
                  : ArrowUpDown;
              return (
                <TableHead
                  key={col.key}
                  aria-sort={
                    isSortedBy
                      ? sortOrder === "desc"
                        ? "descending"
                        : "ascending"
                      : undefined
                  }
                  className={cn(
                    `
                      text-muted-foreground h-auto px-3.5 py-2.5 text-[9px]
                      font-bold tracking-[0.12em] uppercase
                    `,
                    col.className,
                  )}
                >
                  {isSortable ? (
                    <button
                      type="button"
                      onClick={() => onSortChange?.(col.key)}
                      className={cn(
                        `
                          hover:text-foreground
                          focus-visible:ring-ring focus-visible:ring-2
                          focus-visible:outline-none
                          -mx-1 inline-flex items-center gap-1 rounded px-1
                          py-0.5 text-[9px] font-bold tracking-[0.12em]
                          uppercase
                        `,
                        isSortedBy && "text-foreground",
                      )}
                    >
                      {col.header}
                      {SortIcon ? (
                        <SortIcon
                          className={cn("size-3", !isSortedBy && "opacity-50")}
                        />
                      ) : null}
                    </button>
                  ) : (
                    col.header
                  )}
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody aria-busy={loading}>
          {loading ? (
            Array.from({ length: skeletonRows }, (_, rowIdx) => (
              <TableRow
                key={`__skeleton_${rowIdx}`}
                className={`
                  pointer-events-none
                  hover:bg-transparent
                `}
              >
                {enableRowSelection && (
                  <TableCell
                    className={cn(
                      "text-foreground-secondary w-10 max-w-10 min-w-10 px-2",
                      "py-[11px]",
                    )}
                  >
                    <div className="flex justify-center">
                      <Skeleton className="size-4 rounded-sm" />
                    </div>
                  </TableCell>
                )}
                {columns.map((col, colIdx) => (
                  <TableCell
                    key={col.key}
                    className={cn(
                      "text-foreground-secondary px-3.5 py-[11px]",
                      col.className,
                    )}
                  >
                    <Skeleton
                      className={cn(
                        "h-3.5 w-full",
                        SKELETON_BAR_WIDTHS[
                          (rowIdx + colIdx) % SKELETON_BAR_WIDTHS.length
                        ],
                      )}
                    />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : data.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell
                colSpan={colSpan}
                className={`
                  text-muted-foreground px-3.5 py-10 text-center text-[12.5px]
                `}
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            visibleRowMeta.map(({ item, index, id: rowId }) => {
              const isSelected = selectedIds.has(rowId);
              const rowClickToken = onRowClick
                ? `${rowClickInstanceId}:${rowId}`
                : undefined;
              return (
                <TableRow
                  key={rowId}
                  data-state={isSelected ? "selected" : undefined}
                  {...(rowClickToken
                    ? { [ROW_CLICK_SURFACE]: rowClickToken }
                    : {})}
                  onClick={() => {
                    if (!onRowClick || !rowClickToken) return;
                    if (pointerDownSurfaceRef.current !== rowClickToken) return;
                    onRowClick(item);
                  }}
                  className={cn(
                    `
                      border-border/40 border-b
                      last:border-b-0
                    `,
                    "hover:bg-primary/3",
                    onRowClick && "cursor-pointer",
                    getRowClassName?.(item, index),
                  )}
                >
                  {enableRowSelection && (
                    <TableCell
                      className={cn(
                        "text-foreground-secondary w-10 max-w-10 min-w-10 px-2",
                        "py-[11px]",
                      )}
                      onClick={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      <div className="flex justify-center">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleRow(rowId)}
                          aria-label={`Select row ${rowId}`}
                        />
                      </div>
                    </TableCell>
                  )}
                  {columns.map((col) => (
                    <TableCell
                      key={col.key}
                      className={cn(
                        `
                          text-foreground-secondary px-3.5 py-[11px]
                          text-[12.5px]
                        `,
                        col.className,
                      )}
                    >
                      {col.render
                        ? col.render(item, index)
                        : ((item as Record<string, unknown>)[
                            col.key
                          ] as React.ReactNode)}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })
          )}
        </TableBody>
        {footer && !loading && data.length > 0 && (
          <TableFooter className="bg-surface-secondary/40">
            {footer}
          </TableFooter>
        )}
      </Table>
      {pagination && (
        <>
          <Separator />
          <div className="bg-surface-secondary/30 px-3 py-1">{pagination}</div>
        </>
      )}
    </div>
  );
}
