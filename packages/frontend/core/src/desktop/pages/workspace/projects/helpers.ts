// Shared presentation + date helpers for the Projects list (index.tsx) and
// detail (detail.tsx) views. Extracted into one module because a prior refactor
// left these defined only in detail.tsx while index.tsx still called them —
// shipping a runtime `ReferenceError` in the Kanban view (CLAUDE.md §2.2
// dropped-dependency scar). Keep both views importing from here.
import type {
  MnTaskPriority,
  MnTaskStatus,
} from '@affine/core/modules/manut-pm';

import * as listStyles from './projects.css';

export function readableStatus(value: MnTaskStatus): string {
  switch (value) {
    case 'IN_PROGRESS':
      return 'In progress';
    case 'BACKLOG':
      return 'Backlog';
    case 'TODO':
      return 'To do';
    case 'DONE':
      return 'Done';
    case 'CANCELLED':
      return 'Cancelled';
    default:
      return value;
  }
}

export function readablePriority(value: MnTaskPriority): string {
  switch (value) {
    case 'NONE':
      return 'No priority';
    case 'LOW':
      return 'Low';
    case 'MEDIUM':
      return 'Medium';
    case 'HIGH':
      return 'High';
    case 'URGENT':
      return 'Urgent';
    default:
      return value;
  }
}

export function priorityClass(priority: MnTaskPriority): string {
  switch (priority) {
    case 'URGENT':
      return listStyles.priorityUrgent;
    case 'HIGH':
      return listStyles.priorityHigh;
    case 'MEDIUM':
      return listStyles.priorityMedium;
    case 'LOW':
      return listStyles.priorityLow;
    case 'NONE':
    default:
      return listStyles.priorityNone;
  }
}

// `dueAt` is persisted as an ISO timestamp pinned to UTC midnight (see
// `dueAtToIso`). It MUST be read back with UTC getters so a date picked as
// "Jan 15" round-trips to "Jan 15" in every timezone.
export function dueAtToIso(dateOnly: string | null): string | null {
  if (!dateOnly) return null;
  const t = Date.parse(`${dateOnly}T00:00:00.000Z`);
  if (Number.isNaN(t)) return null;
  return new Date(t).toISOString();
}

export function dueAtInputValue(value: string | null): string {
  if (!value) return '';
  const t = Date.parse(value);
  if (Number.isNaN(t)) return '';
  const d = new Date(t);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDueDate(value: string | null): string {
  if (!value) return '';
  const t = Date.parse(value);
  if (Number.isNaN(t)) return '';
  const d = new Date(t);
  const now = new Date();
  return d.toLocaleDateString(undefined, {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    year: d.getUTCFullYear() === now.getUTCFullYear() ? undefined : 'numeric',
  });
}
