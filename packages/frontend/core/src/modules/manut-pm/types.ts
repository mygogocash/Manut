/**
 * Frontend types for the Manut PM (Projects + Tasks) module.
 *
 * Mirrors the backend DTOs in
 * `packages/backend/server/src/plugins/manut/manut-pm.dto.ts`
 * and the Prisma enums in `schema.prisma`. Co-located with the frontend
 * call sites because `@affine/graphql` codegen has not been re-run yet
 * for these operations.
 */

export type MnProjectStatus = 'ACTIVE' | 'ARCHIVED';

export type MnTaskStatus =
  | 'BACKLOG'
  | 'TODO'
  | 'IN_PROGRESS'
  | 'DONE'
  | 'CANCELLED';

export type MnTaskPriority = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export const MN_TASK_STATUSES: readonly MnTaskStatus[] = [
  'BACKLOG',
  'TODO',
  'IN_PROGRESS',
  'DONE',
  'CANCELLED',
];

export const MN_TASK_PRIORITIES: readonly MnTaskPriority[] = [
  'NONE',
  'LOW',
  'MEDIUM',
  'HIGH',
  'URGENT',
];

export interface MnProjectDto {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  status: MnProjectStatus;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface MnTaskDto {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: MnTaskStatus;
  priority: MnTaskPriority;
  dueAt: string | null;
  listSortOrder: number;
  assigneeUserId: string | null;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMnProjectInput {
  name: string;
  description?: string | null;
  sortOrder?: number | null;
}

export interface CreateMnTaskInput {
  title: string;
  description?: string | null;
  status?: MnTaskStatus;
  priority?: MnTaskPriority;
  dueAt?: string | null;
  listSortOrder?: number | null;
  assigneeUserId?: string | null;
}

export interface UpdateMnProjectInput {
  name?: string | null;
  description?: string | null;
  status?: MnProjectStatus | null;
  sortOrder?: number | null;
}

export interface UpdateMnTaskInput {
  title?: string | null;
  description?: string | null;
  status?: MnTaskStatus;
  priority?: MnTaskPriority;
  dueAt?: string | null;
  listSortOrder?: number | null;
  assigneeUserId?: string | null;
}

// ---------------------------------------------------------------------------
// M2 — goals, task ancestry, blockers, AI session task-link.
// ---------------------------------------------------------------------------

export type MnGoalLevel = 'PROJECT' | 'TEAM' | 'AGENT' | 'TASK';

export type MnGoalStatus = 'PLANNED' | 'ACTIVE' | 'ACHIEVED' | 'CANCELLED';

export const MN_GOAL_LEVELS: readonly MnGoalLevel[] = [
  'PROJECT',
  'TEAM',
  'AGENT',
  'TASK',
];

export const MN_GOAL_STATUSES: readonly MnGoalStatus[] = [
  'PLANNED',
  'ACTIVE',
  'ACHIEVED',
  'CANCELLED',
];

export interface MnGoalDto {
  id: string;
  workspaceId: string;
  projectId: string;
  title: string;
  description: string | null;
  level: MnGoalLevel;
  parentGoalId: string | null;
  ownerAgentId: string | null;
  status: MnGoalStatus;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMnGoalInput {
  projectId: string;
  title: string;
  description?: string | null;
  level: MnGoalLevel;
  parentGoalId?: string | null;
  ownerAgentId?: string | null;
  status?: MnGoalStatus | null;
}

export interface UpdateMnGoalInput {
  title?: string | null;
  description?: string | null;
  level?: MnGoalLevel | null;
  parentGoalId?: string | null;
  ownerAgentId?: string | null;
  status?: MnGoalStatus | null;
}

export interface MnGoalAncestryStep {
  goalId: string;
  title: string;
  level: MnGoalLevel;
  status: MnGoalStatus;
  depth: number;
}

export interface MnTaskAncestryStep {
  taskId: string;
  title: string;
  depth: number;
}

export interface MnTaskAncestry {
  taskId: string;
  taskTitle: string;
  taskAncestors: MnTaskAncestryStep[];
  goalChain: MnGoalAncestryStep[];
}

export interface MnTaskBlockerDto {
  id: string;
  taskId: string;
  blockedByTaskId: string;
  projectId: string;
  createdAt: string;
}

export interface AddMnTaskBlockerInput {
  taskId: string;
  blockedByTaskId: string;
}
