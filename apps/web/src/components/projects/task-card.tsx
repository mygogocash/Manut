"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarDays } from "lucide-react";
import { useRef } from "react";

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
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, data: { type: "task", task } });

  const pointerDownPos = useRef<{ x: number; y: number } | null>(null);

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
      {...attributes}
      {...listeners}
      onPointerDown={(e) => {
        pointerDownPos.current = { x: e.clientX, y: e.clientY };
        listeners?.onPointerDown?.(e as never);
      }}
      onClick={(e) => {
        if (!pointerDownPos.current) {
          onOpen(task);
          return;
        }
        const dx = Math.abs(e.clientX - pointerDownPos.current.x);
        const dy = Math.abs(e.clientY - pointerDownPos.current.y);
        if (dx < 5 && dy < 5) onOpen(task);
        pointerDownPos.current = null;
      }}
      className={`
        bg-card border-border group cursor-pointer rounded-lg border p-3
        shadow-sm transition-all select-none
        hover:border-primary/20 hover:shadow-md
        active:cursor-grabbing
      `}
    >
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
