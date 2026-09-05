"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  horizontalListSortingStrategy,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";

import { TableCustomizeMenu } from "@/components/shared/table-customize-menu";
import { useTableLayout } from "@/components/shared/use-table-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface TableColumn<Row> {
  /**
   * Stable identity. This is what gets persisted in the org default and in
   * each user's localStorage, so renaming a key silently discards every saved
   * layout that referenced it — change labels freely, keys never.
   */
  key: string;
  label: string;
  align?: "left" | "right";
  render: (row: Row) => ReactNode;
  /**
   * Sort key for this column. Omit to make the column unsortable — right for
   * columns holding badges or free text where an ordering would be arbitrary.
   */
  sortValue?: (row: Row) => number | string | null;
}

const TH = "text-muted-foreground border-b text-left text-[11px] uppercase";

const TABLE_CLS = [
  "w-full text-sm",
  "[&_td]:px-3 [&_th]:px-3",
  "[&_td:first-child]:pl-0 [&_th:first-child]:pl-0",
  "[&_td:last-child]:pr-0 [&_th:last-child]:pr-0",
  "[&_th]:whitespace-nowrap",
].join(" ");

/**
 * Header cell. Draggable to reorder, clickable to sort when the column
 * declares a sortValue.
 *
 * Drag and click are told apart by the sensor's activation distance, not by a
 * separate handle: a pointer move under the threshold bubbles as a click and
 * sorts, anything longer starts the drag.
 */
function SortableTh<Row>({
  col,
  sorted,
  onSort,
}: {
  col: TableColumn<Row>;
  sorted: { key: string; asc: boolean } | null;
  onSort: (key: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: col.key });
  return (
    <th
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : undefined,
      }}
      className={`
        cursor-grab py-2 select-none
        ${col.align === "right" ? "text-right" : ""}
        ${col.sortValue ? "hover:text-foreground" : ""}
      `}
      onClick={col.sortValue ? () => onSort(col.key) : undefined}
      title={
        col.sortValue
          ? `Click to sort by ${col.label}, drag to move`
          : "Drag to move"
      }
      {...attributes}
      {...listeners}
    >
      {col.label}
      {sorted?.key === col.key ? (sorted.asc ? " ▲" : " ▼") : ""}
    </th>
  );
}

/** Body row with a grip handle. Only the grip starts a drag. */
function SortableRow({
  id,
  children,
  showHandle,
}: {
  id: string;
  children: ReactNode;
  showHandle: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  return (
    <tr
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : undefined,
      }}
      className="border-b"
    >
      {showHandle ? (
        <td className="w-6 py-2 pr-0">
          <button
            type="button"
            className={`
              text-muted-foreground/40 cursor-grab touch-none
              hover:text-foreground
            `}
            aria-label="Drag to reorder row"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-3.5" />
          </button>
        </td>
      ) : null}
      {children}
    </tr>
  );
}

/**
 * A table whose columns the reader can reorder, hide and sort, on top of an
 * organisation default an admin published.
 *
 * Columns are declared once as data. Everything that would otherwise be
 * repeated per table — resolving the layout, dropping hidden columns, sort
 * state, the customize menu — happens here, so adopting this on a new table
 * is a column list rather than sixty lines of wiring.
 *
 * Suits tables with a fixed column set. Tables whose columns ARE the data (a
 * column per account, or per month) do not fit: there is no stable key to
 * persist against, and the partner filter already narrows those.
 */
export function CustomizableTable<Row>({
  tableId,
  title,
  columns,
  rows,
  rowKey,
  footer,
  maxHeight,
  headerRight,
  footnote,
  bare,
}: {
  tableId: string;
  title: string;
  columns: TableColumn<Row>[];
  rows: Row[];
  rowKey: (row: Row, index: number) => string;
  /** Totals row. Receives the visible keys so it can span them correctly. */
  footer?: (visibleKeys: string[]) => ReactNode;
  /** Adds a scroll box; omit for tables short enough to render whole. */
  maxHeight?: string;
  headerRight?: ReactNode;
  /** Caveat or source note, rendered under the table inside the card. */
  footnote?: ReactNode;
  /**
   * Render without the Card shell, for tables that already sit inside one —
   * a collapsible panel, say. The customize control moves above the table so
   * it is still reachable.
   */
  bare?: boolean;
}) {
  const code = useMemo(
    () => ({
      order: columns.map((c) => c.key),
      hidden: [] as string[],
      widths: {} as Record<string, number>,
      rowOrder: [] as string[],
    }),
    [columns],
  );
  const layout = useTableLayout(tableId, code);
  const [sort, setSort] = useState<{ key: string; asc: boolean } | null>(null);

  const byKey = useMemo(
    () => new Map(columns.map((c) => [c.key, c])),
    [columns],
  );
  const labels = useMemo(
    () => Object.fromEntries(columns.map((c) => [c.key, c.label])),
    [columns],
  );
  const visible = useMemo(
    () =>
      layout.visibleOrder
        .map((k) => byKey.get(k))
        .filter((c): c is TableColumn<Row> => Boolean(c)),
    [layout.visibleOrder, byKey],
  );

  const ordered = useMemo(() => {
    if (layout.rowOrder.length === 0) return rows;
    // Manual order wins only while nothing is sorted; a saved arrangement and
    // an active sort cannot both be honoured, and the sort is the more recent
    // intent. Rows absent from the saved order keep their natural position at
    // the end, so a wider date range never hides its new rows.
    const rank = new Map(layout.rowOrder.map((k, i) => [k, i]));
    return [...rows].sort((a, b) => {
      const ai = rank.get(rowKey(a, 0)) ?? Number.MAX_SAFE_INTEGER;
      const bi = rank.get(rowKey(b, 0)) ?? Number.MAX_SAFE_INTEGER;
      return ai - bi;
    });
  }, [rows, layout.rowOrder, rowKey]);

  const sorted = useMemo(() => {
    const col = sort ? byKey.get(sort.key) : undefined;
    if (!sort || !col?.sortValue) return ordered;
    const valueOf = col.sortValue;
    // Copy first — `rows` is the fetched payload, which other views read.
    return [...ordered].sort((a, b) => {
      const av = valueOf(a);
      const bv = valueOf(b);
      // Nulls last in both directions: a blank is not "smallest", it is "no
      // answer", and burying them keeps the top of the table meaningful.
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      const cmp =
        typeof av === "string"
          ? av.localeCompare(bv as string)
          : av - (bv as number);
      return sort.asc ? cmp : -cmp;
    });
  }, [ordered, sort, byKey]);

  const rowKeys = sorted.map((r, i) => rowKey(r, i));
  const canDragRows = !sort && rowKeys.length > 1;

  const sensors = useSensors(
    // 4px so a click still reads as a click and sorts.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  function handleDragEnd(e: DragEndEvent) {
    const activeId = String(e.active.id);
    const overId = e.over ? String(e.over.id) : null;
    if (!overId || activeId === overId) return;
    if (layout.order.includes(activeId)) {
      layout.reorder(activeId, overId);
    } else if (canDragRows) {
      layout.reorderRow(activeId, overId, rowKeys);
    }
  }

  const body = (
    <table className={TABLE_CLS}>
      <thead>
        <tr
          className={`
            ${TH}
            ${maxHeight ? "bg-card sticky top-0" : ""}
          `}
        >
          {canDragRows ? <th className="w-6 py-2 pr-0" /> : null}
          <SortableContext
            items={visible.map((c) => c.key)}
            strategy={horizontalListSortingStrategy}
          >
            {visible.map((c) => (
              <SortableTh
                key={c.key}
                col={c}
                sorted={sort}
                onSort={(key) =>
                  setSort((s) =>
                    s?.key === key ? { key, asc: !s.asc } : { key, asc: true },
                  )
                }
              />
            ))}
          </SortableContext>
        </tr>
      </thead>
      <tbody>
        <SortableContext items={rowKeys} strategy={verticalListSortingStrategy}>
          {sorted.map((row, i) => (
            <SortableRow
              key={rowKeys[i]!}
              id={rowKeys[i]!}
              showHandle={canDragRows}
            >
              {visible.map((c) => (
                <td
                  key={c.key}
                  className={`
                    py-2
                    ${c.align === "right" ? "text-right tabular-nums" : ""}
                  `}
                >
                  {c.render(row)}
                </td>
              ))}
            </SortableRow>
          ))}
        </SortableContext>
        {footer?.(
          canDragRows
            ? ["__handle", ...visible.map((c) => c.key)]
            : visible.map((c) => c.key),
        )}
      </tbody>
    </table>
  );

  const note = footnote ? (
    <p className="text-muted-foreground mt-3 text-xs">{footnote}</p>
  ) : null;

  const dragBody = (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      {body}
    </DndContext>
  );

  const scroller = maxHeight ? (
    <div
      className={`
        overflow-auto
        ${maxHeight}
      `}
    >
      {dragBody}
    </div>
  ) : (
    <div className="overflow-x-auto">{dragBody}</div>
  );

  if (bare) {
    return (
      <div>
        <div className="mb-2 flex items-center justify-end gap-2">
          {headerRight}
          <TableCustomizeMenu layout={layout} labels={labels} />
        </div>
        {scroller}
        {note}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="text-sm">{title}</CardTitle>
        <div className="flex items-center gap-2">
          {headerRight}
          <TableCustomizeMenu layout={layout} labels={labels} />
        </div>
      </CardHeader>
      <CardContent>
        {scroller}
        {note}
      </CardContent>
    </Card>
  );
}
