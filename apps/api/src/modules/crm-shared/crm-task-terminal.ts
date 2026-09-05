import { prisma } from "@/infrastructure/database/prisma";

/**
 * Status keys that always mean "finished — stop deadline reminders",
 * regardless of board column layout.
 */
export const TASK_TERMINAL_ALIASES = [
  "done",
  "completed",
  "complete",
  "closed",
] as const;

const DONE_LABELS = new Set(["done", "completed", "complete", "closed"]);

/**
 * Resolve which task `status` values are terminal for a single board.
 *
 * - Always includes {@link TASK_TERMINAL_ALIASES}.
 * - Includes every column whose label is a done-like word (custom key,
 *   e.g. key=`finished` label=`Done`).
 * - Includes the rightmost column (highest `sortOrder`) — dragging into
 *   the final kanban column is what users mean by "completed".
 */
export function buildTerminalTaskKeys(
  columns: Array<{ key: string; label: string; sortOrder: number }>,
): Set<string> {
  const keys = new Set<string>(TASK_TERMINAL_ALIASES);
  if (columns.length === 0) return keys;

  let maxOrder = -Infinity;
  for (const col of columns) {
    maxOrder = Math.max(maxOrder, col.sortOrder);
    if (DONE_LABELS.has(col.label.trim().toLowerCase())) {
      keys.add(col.key);
    }
  }
  for (const col of columns) {
    if (col.sortOrder === maxOrder) keys.add(col.key);
  }
  return keys;
}

/**
 * Map projectId → terminal status keys for every board in `teams`.
 * Used by the daily CRM deadline cron and the notification-bell read-model
 * so a Done/Completed card never keeps nagging after the move.
 */
export async function loadTerminalTaskKeysByProject(
  teams: readonly string[],
): Promise<Map<string, Set<string>>> {
  if (teams.length === 0) return new Map();

  const columns = await prisma.projectColumn.findMany({
    where: { project: { team: { in: [...teams] } } },
    select: {
      projectId: true,
      key: true,
      label: true,
      sortOrder: true,
    },
  });

  const byProject = new Map<
    string,
    Array<{ key: string; label: string; sortOrder: number }>
  >();
  for (const col of columns) {
    const list = byProject.get(col.projectId) ?? [];
    list.push(col);
    byProject.set(col.projectId, list);
  }

  const out = new Map<string, Set<string>>();
  for (const [projectId, cols] of byProject) {
    out.set(projectId, buildTerminalTaskKeys(cols));
  }
  return out;
}

export function isTerminalTaskStatus(
  status: string,
  projectTerminalKeys: Set<string> | undefined,
): boolean {
  if (
    (TASK_TERMINAL_ALIASES as readonly string[]).includes(status) ||
    projectTerminalKeys?.has(status)
  ) {
    return true;
  }
  // No column rows loaded for this project (brand-new board) — still
  // honour the hardcoded aliases via the check above; anything else is open.
  return false;
}
