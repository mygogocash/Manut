"use client";

import {
  type CollisionDetection,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  getFirstCollision,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { format } from "date-fns";
import { Edit, MoreHorizontal, Plus, Trash2, User } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";

import { partnerPriorityVariant } from "@/components/partners/partner-task-meta";
import { Badge } from "@/components/shared/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { stripHtmlToText } from "@/lib/utils";
import type {
  PartnerColumn,
  PartnerTask,
} from "@/services/partner-workspace.service";

export interface PartnerTaskMoveUpdate {
  taskId: string;
  status: string;
  sortOrder: number;
}

interface Props {
  columns: PartnerColumn[];
  tasks: PartnerTask[];
  canEdit: boolean;
  onAddTask: (columnKey: string) => void;
  onViewTask: (task: PartnerTask) => void;
  onEditTask: (task: PartnerTask) => void;
  onDeleteTask: (task: PartnerTask) => void;
  /**
   * Persist a batch of task moves/reorders. The board emits one call
   * per drop containing every task whose `status` or `sortOrder`
   * actually changed. The parent should apply the change optimistically
   * and roll back on error.
   */
  onMoveTasks: (updates: PartnerTaskMoveUpdate[]) => void;
}

// Distinct namespace for the column droppable ids so they can't
// collide with task ids (which are cuids — already safe — but the
// prefix makes the dispatch in `handleDragEnd` explicit).
const COLUMN_DROPPABLE_PREFIX = "partner-col-";
const columnDroppableId = (key: string) => `${COLUMN_DROPPABLE_PREFIX}${key}`;
const isColumnDroppableId = (id: string) =>
  id.startsWith(COLUMN_DROPPABLE_PREFIX);
const columnKeyFromDroppableId = (id: string) =>
  id.slice(COLUMN_DROPPABLE_PREFIX.length);

function formatDate(iso: string | null) {
  if (!iso) return null;
  try {
    return format(new Date(`${iso.slice(0, 10)}T00:00:00`), "MMM d");
  } catch {
    return iso;
  }
}

// ──────────────────────────────────────────────────────────────────
// Sortable task card
// Wraps a card in `useSortable` so the user can drag it. Clicks
// within a small movement threshold still open the detail sheet —
// `activationConstraint.distance: 8` on the PointerSensor keeps the
// drag from starting on a tap, and the local `pointerDown` ref
// guards against a click immediately after a drag.

function SortableTaskCard({
  task,
  canEdit,
  onView,
  onEdit,
  onDelete,
}: {
  task: PartnerTask;
  canEdit: boolean;
  onView: (task: PartnerTask) => void;
  onEdit: (task: PartnerTask) => void;
  onDelete: (task: PartnerTask) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: { type: "task", task },
    disabled: !canEdit,
  });

  const pointerDown = useRef<{ x: number; y: number } | null>(null);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onPointerDown={(e) => {
        pointerDown.current = { x: e.clientX, y: e.clientY };
        listeners?.onPointerDown?.(e as never);
      }}
      onClick={(e) => {
        // Distinguish click (open view) from drag end. Without this
        // any pointer-up beyond the activation threshold also fires
        // a click on the underlying div.
        if (!pointerDown.current) {
          onView(task);
          return;
        }
        const dx = Math.abs(e.clientX - pointerDown.current.x);
        const dy = Math.abs(e.clientY - pointerDown.current.y);
        pointerDown.current = null;
        if (dx < 5 && dy < 5) onView(task);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onView(task);
        }
      }}
      className={`
        border-border/60 bg-background flex cursor-pointer flex-col gap-1.5
        rounded-md border px-2.5 py-2 shadow-sm transition-colors outline-none
        select-none
        hover:border-primary/30
        focus-visible:border-primary/50
        active:cursor-grabbing
      `}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-foreground text-xs font-medium">
          {task.title}
        </span>
        {canEdit ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="size-6"
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              onClick={(e) => e.stopPropagation()}
            >
              <DropdownMenuItem onClick={() => onEdit(task)}>
                <Edit className="mr-2 size-3.5" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className={`
                  text-destructive
                  focus:text-destructive
                `}
                onClick={() => onDelete(task)}
              >
                <Trash2 className="mr-2 size-3.5" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
      {task.description ? (
        <p
          className={`
            text-muted-foreground line-clamp-2 text-[11px] break-words
          `}
        >
          {stripHtmlToText(task.description).slice(0, 100)}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
        <Badge variant={partnerPriorityVariant(task.priority)}>
          {task.priority}
        </Badge>
        {task.endDate ? (
          <span className={`text-muted-foreground text-[10px] tabular-nums`}>
            Due {formatDate(task.endDate)}
          </span>
        ) : null}
        {task.assignees && task.assignees.length > 0 ? (
          <span
            className={`
              text-muted-foreground inline-flex items-center gap-1 text-[10px]
            `}
          >
            <User className="size-3" />
            {task.assignees.length === 1
              ? task.assignees[0].user.name.split(" ")[0]
              : `${task.assignees.length} assignees`}
          </span>
        ) : task.owner ? (
          <span
            className={`
              text-muted-foreground inline-flex items-center gap-1 text-[10px]
            `}
          >
            <User className="size-3" />
            {task.owner.name.split(" ")[0]}
          </span>
        ) : null}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Droppable column
// Each column is a `useDroppable` so an empty column accepts drops;
// when tasks exist, dnd-kit also detects collisions against the
// individual sortable cards inside the `SortableContext`.

function DroppableColumn({
  col,
  tasks,
  canEdit,
  onAddTask,
  onView,
  onEdit,
  onDelete,
}: {
  col: PartnerColumn;
  tasks: PartnerTask[];
  canEdit: boolean;
  onAddTask: (columnKey: string) => void;
  onView: (task: PartnerTask) => void;
  onEdit: (task: PartnerTask) => void;
  onDelete: (task: PartnerTask) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: columnDroppableId(col.key),
    data: { type: "column", columnKey: col.key },
    disabled: !canEdit,
  });

  return (
    <div
      ref={setNodeRef}
      className={`
        border-border/80 bg-muted/20 flex w-[280px] shrink-0 flex-col rounded-lg
        border transition-colors
        ${isOver ? "border-primary/40 bg-muted/40" : ""}
      `}
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <div className="flex items-center gap-2">
          <span
            className={`
              inline-block size-2 rounded-full
              ${col.color || "bg-zinc-500"}
            `}
          />
          <span className="text-foreground text-xs font-semibold">
            {col.label}
          </span>
          <span className="text-muted-foreground text-[10px] tabular-nums">
            {tasks.length}
          </span>
        </div>
        {canEdit ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => onAddTask(col.key)}
            title={`Add task to ${col.label}`}
          >
            <Plus className="size-3.5" />
          </Button>
        ) : null}
      </div>
      <SortableContext
        items={tasks.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-col gap-2 px-2 pb-3">
          {tasks.map((task) => (
            <SortableTaskCard
              key={task.id}
              task={task}
              canEdit={canEdit}
              onView={onView}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
          {tasks.length === 0 ? (
            <p
              className={`
                text-muted-foreground rounded-md border border-dashed py-4
                text-center text-[11px]
              `}
            >
              No tasks yet
            </p>
          ) : null}
        </div>
      </SortableContext>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Board

export function PartnerBoard({
  columns,
  tasks,
  canEdit,
  onAddTask,
  onViewTask,
  onEditTask,
  onDeleteTask,
  onMoveTasks,
}: Props) {
  // Group tasks by column key — falls back to the first column when
  // the task's `status` doesn't match any current column (e.g. a
  // column was deleted and tasks weren't re-bucketed).
  const tasksByColumn = useMemo(() => {
    const map: Record<string, PartnerTask[]> = {};
    for (const c of columns) map[c.key] = [];
    const firstKey = columns[0]?.key ?? "todo";
    for (const t of tasks) {
      const bucket = map[t.status] ?? map[firstKey];
      if (bucket) bucket.push(t);
    }
    for (const c of columns) {
      map[c.key].sort(
        (a, b) =>
          a.sortOrder - b.sortOrder ||
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
    }
    return map;
  }, [columns, tasks]);

  const sensors = useSensors(
    // distance:8 keeps a tap from starting a drag, so click-to-view
    // and the dropdown trigger still behave normally.
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const collisionDetection: CollisionDetection = useCallback((args) => {
    const pointer = pointerWithin(args);
    if (getFirstCollision(pointer, "id")) return pointer;
    return rectIntersection(args);
  }, []);

  const [activeTask, setActiveTask] = useState<PartnerTask | null>(null);

  function handleDragStart(event: DragStartEvent) {
    const t = tasks.find((x) => x.id === event.active.id);
    setActiveTask(t ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);

    const dragged = tasks.find((t) => t.id === activeId);
    if (!dragged) return;
    const sourceKey = dragged.status;

    // Resolve the target column + the index inside it where the card
    // landed. `over.id` is either a column droppable id (empty column
    // or column body) or another task's id (dropped onto a sibling).
    let targetKey: string;
    let dropIndex: number;
    if (isColumnDroppableId(overId)) {
      targetKey = columnKeyFromDroppableId(overId);
      dropIndex = tasksByColumn[targetKey]?.length ?? 0;
    } else {
      const overTask = tasks.find((t) => t.id === overId);
      if (!overTask) return;
      targetKey = overTask.status;
      const list = tasksByColumn[targetKey] ?? [];
      dropIndex = list.findIndex((t) => t.id === overId);
      if (dropIndex < 0) dropIndex = list.length;
    }

    // Compute the new sortOrder for every task whose position
    // actually changed. We renumber the affected column(s) so the
    // server-side ordering matches what the user sees after the
    // optimistic update — otherwise a refetch would snap rows back
    // to their old positions.
    const updates: PartnerTaskMoveUpdate[] = [];

    if (sourceKey === targetKey) {
      const colTasks = tasksByColumn[sourceKey] ?? [];
      const fromIdx = colTasks.findIndex((t) => t.id === activeId);
      if (fromIdx < 0 || fromIdx === dropIndex) return;
      const reordered = arrayMove(colTasks, fromIdx, dropIndex);
      reordered.forEach((t, i) => {
        if (t.sortOrder !== i) {
          updates.push({ taskId: t.id, status: sourceKey, sortOrder: i });
        }
      });
    } else {
      const sourceTasks = (tasksByColumn[sourceKey] ?? []).filter(
        (t) => t.id !== activeId,
      );
      const targetBefore = tasksByColumn[targetKey] ?? [];
      const targetTasks = [
        ...targetBefore.slice(0, dropIndex),
        dragged,
        ...targetBefore.slice(dropIndex),
      ];
      sourceTasks.forEach((t, i) => {
        if (t.sortOrder !== i) {
          updates.push({ taskId: t.id, status: sourceKey, sortOrder: i });
        }
      });
      targetTasks.forEach((t, i) => {
        const moved = t.id === activeId;
        if (moved || t.status !== targetKey || t.sortOrder !== i) {
          updates.push({ taskId: t.id, status: targetKey, sortOrder: i });
        }
      });
    }

    if (updates.length > 0) onMoveTasks(updates);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveTask(null)}
    >
      <div className="flex h-full min-h-0 gap-3 overflow-x-auto pb-3">
        {columns.map((col) => (
          <DroppableColumn
            key={col.id}
            col={col}
            tasks={tasksByColumn[col.key] ?? []}
            canEdit={canEdit}
            onAddTask={onAddTask}
            onView={onViewTask}
            onEdit={onEditTask}
            onDelete={onDeleteTask}
          />
        ))}
      </div>
      <DragOverlay>
        {activeTask ? (
          <div
            className={`
              border-primary/30 bg-background w-[260px] rotate-1 rounded-md
              border px-2.5 py-2 shadow-xl
            `}
          >
            <p className="text-foreground truncate text-xs font-medium">
              {activeTask.title}
            </p>
            <div className="mt-1 flex items-center gap-1.5">
              <Badge variant={partnerPriorityVariant(activeTask.priority)}>
                {activeTask.priority}
              </Badge>
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
