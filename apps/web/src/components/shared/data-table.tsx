"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import * as React from "react";

import { RecordCard } from "@/components/shared/responsive/record-card";
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
import { type Breakpoint, useIsBelow } from "@/hooks/use-breakpoint";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: string;
  render?: (item: T, index: number) => React.ReactNode;
  className?: string;
  /** When true, the header is rendered as a button that calls `onSortChange(key)`. */
  sortable?: boolean;
  /**
   * Where this column goes when the table becomes a card list below 768px.
   *
   *   `title`     — the card heading. One column should have it; if none does,
   *                 the first column is used.
   *   `subtitle`  — one line under the heading.
   *   `badge`     — top-right of the card, for a status pill.
   *   `field`     — always-visible label/value pair.
   *   `detail`    — revealed when the card is expanded.
   *   `actions`   — the row's action control, pinned to the card's action bar.
   *   `hidden`    — omitted from the card entirely.
   *
   * Omitted means "decide for me": see `deriveMobileRoles`. A column never has
   * to opt in, so no existing caller changes.
   *
   * `actions` exists because the derivation cannot tell an action column from a
   * data column, so an un-annotated one becomes a labelled value and ends up
   * behind the expander. That is survivable for a row menu and wrong for an
   * approval: a decision must not be one tap further away on a phone than it is
   * on a desktop. Declaring the role pins it to the card's action bar instead.
   */
  mobileRole?:
    | "title"
    | "subtitle"
    | "badge"
    | "field"
    | "detail"
    | "actions"
    | "hidden";
  /** Shorter label for the card, where the table header is too long. */
  mobileLabel?: string;
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
  /**
   * Accessible name for tables that have no visible `title`. When `title` IS
   * set the visible heading is used via `aria-labelledby`, so this is not
   * needed and a second name is not invented.
   */
  ariaLabel?: string;
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
  /**
   * Pin the header row so it stays visible while the body scrolls. Gives
   * the table its own vertical scroll region (capped at `maxBodyHeight`)
   * and stickies the `<thead>` to the top of it — needed because the page,
   * not the table, is the default scroll context.
   */
  stickyHeader?: boolean;
  /**
   * Tailwind max-height class for the scroll region when `stickyHeader` is
   * on. Must be a literal so Tailwind can see it. Default: `max-h-[70vh]`.
   */
  maxBodyHeightClass?: string;
  /**
   * How the table renders below 768px.
   *
   *   `auto`  — cards on mobile, table above. The default.
   *   `table` — always a table; it scrolls horizontally as it does today. Right
   *             for genuinely matrix-shaped data (a payroll grid, a period
   *             comparison) where a card per row destroys the comparison.
   *   `cards` — always cards, at every width.
   *
   * `auto` is safe as a default because it changes nothing above 768px, and
   * below it the alternative is a table wider than the screen.
   */
  mobileMode?: "auto" | "table" | "cards";
  /**
   * WHERE `mobileMode: "auto"` switches from table to cards. Default `"md"`,
   * which is 768px — exactly today's behaviour, so every existing caller is
   * unaffected by this prop existing.
   *
   * Raise it for a table too wide to read on a tablet. A nine-column request
   * queue needs roughly 1,100px, so between 768px and 1024px it is a table
   * scrolling sideways inside its own container: contained, but not readable.
   * `cardBreakpoint="lg"` turns that span into cards instead.
   *
   * Deliberately a sibling of `mobileMode` rather than folded into it, because
   * the two answer different questions — `mobileMode` is WHETHER to switch,
   * this is WHERE. It has no effect on `"table"` or `"cards"`, which are
   * absolute by definition.
   *
   * Keyed to the same scale Tailwind uses (see `BREAKPOINTS`), so a value here
   * and a `lg:` class in the same component mean the same width.
   */
  cardBreakpoint?: Breakpoint;
  /**
   * Full control of the mobile card. Overrides `mobileRole` derivation.
   * Return your own node per row — usually a `RecordCard`.
   */
  renderMobileCard?: (item: T, index: number) => React.ReactNode;
}

/** A column's card placement, resolved from `mobileRole` plus position. */
export interface ResolvedMobileRoles {
  title: string;
  subtitle?: string;
  badge?: string;
  fields: string[];
  details: string[];
  /** Rendered in the card's action bar rather than as a labelled value. */
  actions?: string;
}

/**
 * Decides what a card shows when the caller has not said.
 *
 * The default has to be *useful without configuration*, because ~75 tables
 * predate this and none of them declares a role. The heuristic: first column
 * identifies the row (it nearly always does — name, title, reference), the next
 * two are worth scanning, everything after that is detail behind a tap.
 *
 * Explicit roles always win, so a caller can fix any table this gets wrong by
 * annotating one column.
 */
/**
 * A screen-reader label for a column whose header is deliberately blank.
 *
 * An empty `<th>` is an axe `empty-table-header` violation and, more to the
 * point, leaves the actions column unnamed when a screen reader walks the row.
 * The header stays visually empty -- this text is `sr-only`.
 */
export function blankHeaderLabel<T>(column: Column<T>): string {
  if (column.mobileLabel) return column.mobileLabel;
  const spaced = column.key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function deriveMobileRoles<T>(
  columns: Column<T>[],
): ResolvedMobileRoles {
  const usable = columns.filter((c) => c.mobileRole !== "hidden");
  const explicit = (role: Column<T>["mobileRole"]) =>
    usable.filter((c) => c.mobileRole === role).map((c) => c.key);

  const subtitleKey = explicit("subtitle")[0];
  const badgeKey = explicit("badge")[0];
  const actionsKey = explicit("actions")[0];

  // Falling back to `usable[0]` alone titled the card with whatever came first,
  // including table chrome: Phase 8B measured a card headed by a Checkbox
  // (`head=""`) and one headed by a row number (`head="1"`).
  //
  // The derivation only sees column DESCRIPTORS -- it has no row data, so it
  // cannot ask what a cell renders. The one signal it does have is the header,
  // and the rule has to be careful with it: a blank header does NOT mean a
  // column is chrome. `it-operations` labels its request-number column "#", and
  // that column is the record's identifier and must stay titleable.
  //
  // So: skip only columns with a COMPLETELY EMPTY header, and only while a
  // labelled one is still available. A table whose headers are all blank keeps
  // its old title rather than losing one. The explicit `actions` column is
  // never a title -- an action control is not a heading under any reading.
  const titleCandidates = usable.filter((c) => c.key !== actionsKey);
  const labelled = titleCandidates.find((c) => (c.header ?? "").trim() !== "");
  const titleKey =
    explicit("title")[0] ??
    labelled?.key ??
    titleCandidates[0]?.key ??
    usable[0]?.key ??
    "";

  const claimed = new Set(
    [titleKey, subtitleKey, badgeKey, actionsKey].filter(Boolean) as string[],
  );

  const declaredFields = explicit("field").filter((k) => !claimed.has(k));
  const declaredDetails = explicit("detail").filter((k) => !claimed.has(k));
  declaredFields.forEach((k) => claimed.add(k));
  declaredDetails.forEach((k) => claimed.add(k));

  // Anything with no declared role, in table order.
  const remaining = usable
    .filter((c) => !c.mobileRole && !claimed.has(c.key))
    .map((c) => c.key);

  const anyDeclared =
    declaredFields.length > 0 ||
    declaredDetails.length > 0 ||
    Boolean(subtitleKey);

  return {
    title: titleKey,
    subtitle: subtitleKey,
    badge: badgeKey,
    actions: actionsKey,
    // With no annotations at all, promote the next two columns to visible
    // fields; once the caller has annotated anything, respect their intent and
    // do not invent extra visible fields.
    fields: anyDeclared
      ? declaredFields
      : [...declaredFields, ...remaining.slice(0, 2)],
    details: anyDeclared
      ? [...declaredDetails, ...remaining]
      : [...declaredDetails, ...remaining.slice(2)],
  };
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
  ariaLabel,
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
  stickyHeader = false,
  maxBodyHeightClass = "max-h-[70vh]",
  mobileMode = "auto",
  cardBreakpoint = "md",
  renderMobileCard,
}: DataTableProps<T>) {
  // Default "md" reproduces the previous hardcoded 768px exactly.
  const isCompact = useIsBelow(cardBreakpoint);
  const asCards =
    mobileMode === "cards" || (mobileMode === "auto" && isCompact);
  const mobileRoles = React.useMemo(
    () => deriveMobileRoles(columns),
    [columns],
  );
  const getRowId = getRowIdProp ?? defaultGetRowId;
  const rowClickInstanceId = React.useId();
  // The visible <h3> has always been the table's name on screen; it was just
  // never announced as one. Pointing `aria-labelledby` at it names the table
  // and the scroll region without inventing a second label or a <caption>
  // that would duplicate a heading the user can already see.
  const titleId = React.useId();
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
              id={titleId}
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

      {/* Mobile: a card per row. Everything around it — the title bar, the
          selection bar, the pagination — is shared with the table path, so the
          two representations cannot drift apart in behaviour. */}
      {asCards ? (
        <div className="min-w-0 space-y-2.5 p-2.5">
          {loading ? (
            Array.from({ length: Math.min(skeletonRows, 6) }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-lg" />
            ))
          ) : data.length === 0 ? (
            <p
              className={`text-muted-foreground px-2 py-10 text-center text-sm`}
            >
              {emptyMessage}
            </p>
          ) : (
            data.map((item, index) => {
              const rowId = getRowId(item, index);
              if (renderMobileCard) {
                return (
                  <React.Fragment key={rowId}>
                    {renderMobileCard(item, index)}
                  </React.Fragment>
                );
              }

              const cellFor = (key: string | undefined) => {
                if (!key) return undefined;
                const col = columns.find((c) => c.key === key);
                if (!col) return undefined;
                return col.render
                  ? col.render(item, index)
                  : ((item as Record<string, unknown>)[
                      col.key
                    ] as React.ReactNode);
              };
              const labelFor = (key: string) => {
                const col = columns.find((c) => c.key === key);
                return col?.mobileLabel ?? col?.header ?? key;
              };
              const pairs = (keys: string[]) =>
                keys.map((key) => ({
                  label: labelFor(key),
                  value: cellFor(key),
                }));

              return (
                <RecordCard
                  key={rowId}
                  title={cellFor(mobileRoles.title) ?? "—"}
                  subtitle={cellFor(mobileRoles.subtitle)}
                  badge={cellFor(mobileRoles.badge)}
                  fields={pairs(mobileRoles.fields)}
                  details={
                    mobileRoles.details.length > 0
                      ? pairs(mobileRoles.details)
                      : undefined
                  }
                  selected={enableRowSelection && selectedIds.has(rowId)}
                  actions={cellFor(mobileRoles.actions)}
                  onClick={onRowClick ? () => onRowClick(item) : undefined}
                  leading={
                    enableRowSelection ? (
                      <Checkbox
                        checked={selectedIds.has(rowId)}
                        onCheckedChange={() => toggleRow(rowId)}
                        aria-label="Select row"
                      />
                    ) : undefined
                  }
                />
              );
            })
          )}
        </div>
      ) : (
        <Table
          aria-labelledby={title ? titleId : undefined}
          aria-label={title ? undefined : ariaLabel}
          containerClassName={
            stickyHeader ? cn("overflow-y-auto", maxBodyHeightClass) : undefined
          }
        >
          <TableHeader
            className={
              stickyHeader
                ? `
                  sticky top-0 z-20
                  [&_tr]:border-b-0
                `
                : undefined
            }
          >
            <TableRow
              className={cn(
                `
                  border-border bg-surface-secondary border-b
                  hover:bg-transparent
                `,
                // A sticky header sits over scrolling rows, so it needs an
                // opaque background (bg-surface-secondary already is) and its
                // own bottom border since the thead border is cleared above.
                stickyHeader && "border-b",
              )}
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
                            className={cn(
                              "size-3",
                              !isSortedBy && "opacity-50",
                            )}
                          />
                        ) : null}
                      </button>
                    ) : col.header ? (
                      col.header
                    ) : (
                      <span className="sr-only">
                        {blankHeaderLabel(col)}
                      </span>
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
                      if (pointerDownSurfaceRef.current !== rowClickToken) {
                        return;
                      }
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
                          `
                            text-foreground-secondary w-10 max-w-10 min-w-10
                            px-2
                          `,
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
      )}
      {pagination && (
        <>
          <Separator />
          <div className="bg-surface-secondary/30 px-3 py-1">{pagination}</div>
        </>
      )}
    </div>
  );
}
