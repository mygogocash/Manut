"use client";

import { CalendarDays, Eye, FolderInput } from "lucide-react";

import {
  formatDateShort,
  formatTaskPriority,
  getAssigneeName,
  taskPriorityBadge,
} from "@/components/projects/project-board-utils";
import { Badge } from "@/components/shared/badge";
import { RecordCard } from "@/components/shared/responsive/record-card";
import {
  type ResponsiveAction,
  ResponsiveActions,
} from "@/components/shared/responsive/responsive-actions";
import { stripHtmlToText } from "@/lib/utils";
import type { Task } from "@/services/project.service";

// One task, as a card, for the widths where the board is not a board.
//
// Below 1024px the five 270px columns are 1,414px of horizontal scroll showing
// roughly one column at a time, and dragging a card does not work on touch at
// all (see PHASE_7B §11). So the board becomes a status tab plus this list.
//
// Everything the desktop card shows is here, from the SAME helpers in
// `project-board-utils`, so a priority, a date or an assignee cannot render
// differently between the two. Nothing is behind an expander, because there is
// nothing left over: the desktop card has five things on it and so does this.
//
// The one deliberate difference: the desktop card `truncate`s its title to a
// single line, because it lives in a fixed 270px column. Here the title wraps —
// a card is the only place the title appears before opening the task, and
// clipping it is how somebody taps the wrong one.

export interface TaskMobileCardProps {
  task: Task;
  /** Opens the existing task detail sheet — the same handler the board uses. */
  onOpen: (task: Task) => void;
  /**
   * Opens the move sheet. Absent when the board is read-only, which is how a
   * request still awaiting approval already behaves on desktop.
   */
  onMove?: (task: Task) => void;
}

export function TaskMobileCard({ task, onOpen, onMove }: TaskMobileCardProps) {
  const assigneeName = getAssigneeName(task);
  const description = task.description
    ? stripHtmlToText(task.description).slice(0, 100)
    : undefined;

  const fields = [
    assigneeName ? { label: "Assignee", value: assigneeName } : null,
    task.endDate
      ? {
          label: "Due",
          value: (
            <span className="flex items-center gap-1">
              <CalendarDays aria-hidden className="size-3.5 shrink-0" />
              {formatDateShort(task.endDate)}
            </span>
          ),
        }
      : null,
  ].filter((f) => f !== null);

  const actions: ResponsiveAction[] = [
    {
      id: "open",
      label: "Open",
      icon: Eye,
      variant: "primary",
      onSelect: () => onOpen(task),
    },
    {
      id: "move",
      label: "Move",
      icon: FolderInput,
      variant: "secondary",
      onSelect: () => onMove?.(task),
      hidden: !onMove,
    },
  ];

  return (
    <RecordCard
      title={task.title}
      subtitle={description}
      badge={
        <Badge status={taskPriorityBadge(task.priority)} className="text-[10px]">
          {formatTaskPriority(task.priority)}
        </Badge>
      }
      fields={fields}
      // Tapping the card opens the task, the same destination as Open and the
      // same as tapping the card on the desktop board.
      onClick={() => onOpen(task)}
      actions={<ResponsiveActions actions={actions} maxVisibleMobile={2} />}
    />
  );
}
