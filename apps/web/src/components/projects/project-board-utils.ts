import {
  normalizeProjectTaskPriority,
  projectTaskPriorityLabel,
} from "@/components/projects/task-priority";
import type { ProjectColumn, Task } from "@/services/project.service";

export const DEFAULT_COLUMNS: ProjectColumn[] = [
  {
    id: "backlog",
    key: "backlog",
    label: "Backlog",
    color: "bg-zinc-500",
    sortOrder: 0,
  },
  {
    id: "todo",
    key: "todo",
    label: "To Do",
    color: "bg-blue-500",
    sortOrder: 1,
  },
  {
    id: "in_progress",
    key: "in_progress",
    label: "In Progress",
    color: "bg-amber-500",
    sortOrder: 2,
  },
  {
    id: "in_review",
    key: "in_review",
    label: "In Review",
    color: "bg-purple-500",
    sortOrder: 3,
  },
  {
    id: "done",
    key: "done",
    label: "Done",
    color: "bg-emerald-500",
    sortOrder: 4,
  },
];

export const PRIORITY_BADGE: Record<string, string> = {
  P0: "rejected",
  P1: "in_progress",
  P2: "neutral",
  // Legacy rows before migration normalizes in the UI
  low: "neutral",
  medium: "in_progress",
  high: "pending",
  urgent: "rejected",
  critical: "rejected",
};

export const PRIORITY_COLORS: Record<string, string> = {
  P0: "text-red-500",
  P1: "text-blue-500",
  P2: "text-zinc-500",
  low: "text-zinc-500",
  medium: "text-blue-500",
  high: "text-amber-500",
  urgent: "text-red-500",
  critical: "text-red-600",
};

export function formatTaskPriority(raw: string | null | undefined): string {
  return projectTaskPriorityLabel(raw);
}

export function taskPriorityBadge(raw: string | null | undefined): string {
  const key = normalizeProjectTaskPriority(raw);
  return PRIORITY_BADGE[key] ?? "neutral";
}

export function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function formatDateShort(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  });
}

export function formatDateLong(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getAssigneeName(task: Task) {
  if (task.owner && typeof task.owner === "object") return task.owner.name;
  return task.assigneeName;
}

export function getAssigneeId(task: Task) {
  if (task.owner && typeof task.owner === "object") return task.owner.id;
  return task.assigneeId;
}
