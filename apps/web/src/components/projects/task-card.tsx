"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarDays, GripVertical } from "lucide-react";

import {
  formatDateShort,
  formatTaskPriority,
  getAssigneeName,
  getInitials,
  taskPriorityBadge,
} from "@/components/projects/project-board-utils";
import { Badge } from "@/components/shared/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { stripHtmlToText } from "@/lib/utils";
import type { Task } from "@/services/project.service";

export function SortableTaskCard({
  task,
  onOpen,
}: {
  task: Task;
  onOpen: (task: Task) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, data: { type: "task", task } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const assigneeName = getAssigneeName(task);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        bg-card border-border group rounded-lg border p-3 shadow-sm
        transition-all
        hover:border-primary/20 hover:shadow-md
      `}
    >
      <div className="flex items-start gap-1.5">
        {/*
          The drag activator, and the ONLY drag surface on this card.
          Previously the whole card carried the listeners, which meant a touch
          gesture anywhere on it raced the browser's own scroll: dnd-kit's
          PointerSensor aborts on `pointercancel`, and a card with the default
          `touch-action` is exactly what makes the browser fire one. `touch-none`
          belongs HERE and nowhere else — putting it on the card body would stop
          the board scrolling by touch at all, trading one broken gesture for
          another. This is the pattern the column grip has always used.

          `touch-target` expands the hit area to 44px with a centred
          pseudo-element, so the grip meets WCAG 2.5.5 without the icon growing
          or the card's header shifting. Padding alone came to 36px, and the
          extra padding needed to reach 44 would have pushed past the card's own
          `p-3`. Safe against the adjacent opener: the pseudo-element extends
          4px per side and the gap is 6px.
        */}
        <button
          ref={setActivatorNodeRef}
          type="button"
          aria-label={`Reorder task: ${task.title}`}
          className={`
            touch-target text-muted-foreground -my-1 -ml-1 shrink-0 cursor-grab
            touch-none rounded p-2.5
            focus-visible:ring-ring focus-visible:ring-2
            focus-visible:outline-none
            hover:text-foreground
            active:cursor-grabbing
          `}
          {...attributes}
          {...listeners}
        >
          <GripVertical aria-hidden className="size-4" />
        </button>

        {/*
          Opening the task is a button rather than a click handler on the card,
          so it is reachable by keyboard and announced as an action. It is a
          SIBLING of the grip, never a parent — nesting the two would make the
          grip un-activatable and the nesting invalid.
        */}
        <button
          type="button"
          onClick={() => onOpen(task)}
          className={`
            min-w-0 flex-1 cursor-pointer text-left
            focus-visible:ring-ring focus-visible:rounded-sm
            focus-visible:ring-2 focus-visible:outline-none
          `}
        >
          <p className="truncate text-[13px] font-medium">{task.title}</p>
          {task.description && (
            <p className="text-muted-foreground mt-0.5 line-clamp-2 text-[11px]">
              {stripHtmlToText(task.description).slice(0, 100)}
            </p>
          )}
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-6">
        <Badge
          status={taskPriorityBadge(task.priority)}
          className="text-[10px]"
        >
          {formatTaskPriority(task.priority)}
        </Badge>
        {task.endDate && (
          <span
            className={`
              text-muted-foreground flex items-center gap-1 text-[10px]
            `}
          >
            <CalendarDays className="size-3" />
            {formatDateShort(task.endDate)}
          </span>
        )}
        {assigneeName && (
          <Avatar className="ml-auto size-5">
            <AvatarFallback className="text-[7px] font-bold">
              {getInitials(assigneeName)}
            </AvatarFallback>
          </Avatar>
        )}
      </div>
    </div>
  );
}

export function TaskCardOverlay({
  task,
  compact,
}: {
  task: Task;
  compact?: boolean;
}) {
  const assigneeName = getAssigneeName(task);

  if (compact) {
    return (
      <div className={`bg-card border-border rounded-lg border p-3 shadow-sm`}>
        <p className="truncate text-[13px] font-medium">{task.title}</p>
        {task.description && (
          <p className="text-muted-foreground mt-0.5 line-clamp-2 text-[11px]">
            {stripHtmlToText(task.description).slice(0, 100)}
          </p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Badge
            status={taskPriorityBadge(task.priority)}
            className="text-[10px]"
          >
            {formatTaskPriority(task.priority)}
          </Badge>
          {task.endDate && (
            <span
              className={`
                text-muted-foreground flex items-center gap-1 text-[10px]
              `}
            >
              <CalendarDays className="size-3" />
              {formatDateShort(task.endDate)}
            </span>
          )}
          {assigneeName && (
            <Avatar className="ml-auto size-5">
              <AvatarFallback className="text-[7px] font-bold">
                {getInitials(assigneeName)}
              </AvatarFallback>
            </Avatar>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`
        bg-card border-primary/30 w-[250px] rotate-2 rounded-lg border p-3
        shadow-xl
      `}
    >
      <p className="truncate text-[13px] font-medium">{task.title}</p>
      <Badge
        status={taskPriorityBadge(task.priority)}
        className="mt-1.5 text-[10px]"
      >
        {formatTaskPriority(task.priority)}
      </Badge>
    </div>
  );
}
