/**
 * Frontend types for the Superflow PM (Projects + Tasks) module.
 *
 * Mirrors the backend DTOs in
 * `packages/backend/server/src/plugins/superflow/superflow-pm.dto.ts`
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

export const SF_TASK_STATUSES: readonly MnTaskStatus[] = [
  'BACKLOG',
  'TODO',
  'IN_PROGRESS',
  'DONE',
  'CANCELLED',
];

export const SF_TASK_PRIORITIES: readonly MnTaskPriority[] = [
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
