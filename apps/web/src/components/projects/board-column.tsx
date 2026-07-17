"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Edit, GripVertical, Plus, Trash2 } from "lucide-react";
import { useCallback } from "react";
import { toast } from "sonner";

import {
  SortableTaskCard,
  TaskCardOverlay,
} from "@/components/projects/task-card";
import { Badge as ShadcnBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ProjectColumn, Task } from "@/services/project.service";

function assignRefs(
  node: HTMLDivElement | null,
  ...refs: Array<((el: HTMLDivElement | null) => void) | undefined | null>
) {
  for (const ref of refs) {
    if (typeof ref === "function") ref(node);
    else if (ref && "current" in ref) {
      (ref as { current: HTMLDivElement | null }).current = node;
    }
  }
}

const COLUMN_SORTABLE_PREFIX = "col-";

export function getColumnSortableId(column: ProjectColumn) {
  return `${COLUMN_SORTABLE_PREFIX}${column.id}`;
}

export function ColumnDragOverlay({
  column,
  tasks,
}: {
  column: ProjectColumn;
  tasks: Task[];
}) {
  return (
    <div
      className={`
        border-primary/30 bg-surface flex w-[270px] shrink-0 rotate-1 flex-col
        rounded-xl border shadow-xl
      `}
    >
      <div className="flex items-center gap-2 p-3 pb-2">
        <GripVertical className="text-muted-foreground size-4 shrink-0" />
        <div
          className={`
            size-2 shrink-0 rounded-full
            ${column.color}
          `}
        />
        <span className="text-[12px] font-semibold">{column.label}</span>
        <ShadcnBadge variant="secondary" className="px-1.5 py-0.5 text-[10px]">
          {tasks.length}
        </ShadcnBadge>
      </div>
      <div
        className={`flex max-h-[400px] flex-col gap-2 overflow-hidden p-2 pt-0`}
      >
        {tasks.map((task) => (
          <TaskCardOverlay key={task.id} task={task} compact />
        ))}
      </div>
    </div>
  );
}

export function DroppableColumn({
  column,
  tasks,
  onAddClick,
  onOpenTask,
  onEditColumn,
  onDeleteColumn,
  canManageStructure = true,
}: {
  column: ProjectColumn;
  tasks: Task[];
  onAddClick: (status: string) => void;
  onOpenTask: (task: Task) => void;
  onEditColumn: (col: ProjectColumn) => void;
  onDeleteColumn: (id: string) => void;
  /** Owner-only: column reorder, rename, delete */
  canManageStructure?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: getColumnSortableId(column),
    data: { type: "board-column", column },
    disabled: !canManageStructure,
  });

  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `column-${column.key}`,
    data: { type: "task-column", columnKey: column.key },
  });

  const setRefs = useCallback(
    (node: HTMLDivElement | null) =>
      assignRefs(node, setSortableRef, setDroppableRef),
    [setSortableRef, setDroppableRef],
  );

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
  };

  return (
    <div
      ref={setRefs}
      style={style}
      className={`
        border-border flex h-full max-h-full min-h-0 w-[270px] shrink-0 flex-col
        rounded-xl border transition-colors
        ${isOver ? "bg-primary/5 border-primary/30" : "bg-surface"}
      `}
    >
      <div className="group flex items-center justify-between gap-1 p-3 pb-2">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          {canManageStructure ? (
            <button
              ref={setActivatorNodeRef}
              type="button"
              className={`
                text-muted-foreground -ml-0.5 shrink-0 cursor-grab touch-none
                rounded p-0.5
                hover:text-foreground
                active:cursor-grabbing
              `}
              aria-label="Reorder column"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="size-4" />
            </button>
          ) : (
            <span ref={setActivatorNodeRef} className="sr-only" aria-hidden />
          )}
          <div
            className={`
              size-2 shrink-0 rounded-full
              ${column.color}
            `}
          />
          <span className="truncate text-[12px] font-semibold">
            {column.label}
          </span>
          <ShadcnBadge
            variant="secondary"
            className="shrink-0 px-1.5 py-0.5 text-[10px]"
          >
            {tasks.length}
          </ShadcnBadge>
        </div>
        <div className="flex items-center gap-0.5">
          {canManageStructure && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className={`
                  size-6 opacity-0 transition-opacity
                  group-hover:opacity-100
                `}
                onClick={() => onEditColumn(column)}
              >
                <Edit className="size-2.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={`
                  size-6 opacity-0 transition-opacity
                  group-hover:opacity-100
                `}
                onClick={() => {
                  if (tasks.length > 0) {
                    toast.error("Move tasks out before deleting this column");
                    return;
                  }
                  onDeleteColumn(column.id);
                }}
              >
                <Trash2 className="size-2.5" />
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            onClick={() => onAddClick(column.key)}
          >
            <Plus className="size-3" />
          </Button>
        </div>
      </div>
      <SortableContext
        items={tasks.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
      >
        <div
          className={`
            flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto
            overscroll-contain p-2 pt-0
          `}
        >
          {tasks.map((task) => (
            <SortableTaskCard key={task.id} task={task} onOpen={onOpenTask} />
          ))}
          {isOver && (
            <div
              className={`
                border-primary/30 bg-primary/5 flex h-16 items-center
                justify-center rounded-lg border-2 border-dashed transition-all
              `}
            >
              <span className="text-primary/50 text-xs">Drop here</span>
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}
