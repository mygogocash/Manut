"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type React from "react";

import { MIN_COLUMN_WIDTH } from "@/components/shared/use-column-widths";
import { TableHead } from "@/components/ui/table";

// Draggable + resizable table-header cell for CRM column controls.
// Pairs with useColumnOrder (reorder) and useColumnWidths (resize) plus
// a horizontalListSortingStrategy SortableContext in the header row.
// `colKey` must match the SortableContext item id.
//
// When `width`/`onResize` are supplied the cell renders a right-edge
// resize affordance; its pointer events are stopped from bubbling so a
// resize drag never starts the dnd-kit reorder drag.
//
// When `sortable` is true the head also fires `onSortClick(colKey)` on
// click. Drag vs click is disambiguated by the PointerSensor's
// `activationConstraint.distance` — sub-threshold pointer moves bubble
// as clicks; longer drags start the reorder.
export function SortableColumnHead({
  colKey,
  label,
  className,
  width,
  minWidth = MIN_COLUMN_WIDTH,
  onResize,
  sortable,
  sortBy,
  sortOrder,
  onSortClick,
}: {
  colKey: string;
  label: string;
  className?: string;
  width?: number;
  minWidth?: number;
  onResize?: (colKey: string, width: number) => void;
  sortable?: boolean;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  onSortClick?: (colKey: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: colKey });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    ...(width != null ? { width, minWidth } : null),
  };

  function startResize(e: React.PointerEvent) {
    if (!onResize || width == null) return;
    // Keep the resize gesture out of dnd-kit's reorder sensor.
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = width;
    const onMove = (ev: PointerEvent) => {
      onResize(colKey, Math.max(minWidth, startW + (ev.clientX - startX)));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  const resizable = onResize != null && width != null;
  const isSortedBy = sortable && sortBy === colKey;
  const SortIcon = !sortable
    ? null
    : isSortedBy
      ? sortOrder === "desc"
        ? ArrowDown
        : ArrowUp
      : ArrowUpDown;

  return (
    <TableHead
      ref={setNodeRef}
      style={style}
      onClick={sortable && onSortClick ? () => onSortClick(colKey) : undefined}
      className={`
        ${className ?? ""}
        relative cursor-grab select-none
        active:cursor-grabbing
      `}
      {...attributes}
      {...listeners}
    >
      <span className="inline-flex items-center gap-1.5">
        {label}
        {SortIcon ? (
          <SortIcon
            aria-hidden
            className={`
              size-3
              ${isSortedBy ? "text-foreground" : "text-muted-foreground/60"}
            `}
          />
        ) : null}
      </span>
      {resizable ? (
        <span
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize column"
          onPointerDown={startResize}
          onClick={(e) => e.stopPropagation()}
          className={`
            hover:bg-border
            active:bg-border
            absolute top-0 right-0 z-10 h-full w-1.5 cursor-col-resize
            touch-none
          `}
        />
      ) : null}
    </TableHead>
  );
}
