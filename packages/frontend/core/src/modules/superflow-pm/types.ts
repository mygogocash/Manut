/**
 * Frontend types for the Superflow PM (Projects + Tasks) module.
 *
 * Mirrors the backend DTOs in
 * `packages/backend/server/src/plugins/superflow/superflow-pm.dto.ts`
 * and the Prisma enums in `schema.prisma`. Co-located with the frontend
 * call sites because `@affine/graphql` codegen has not been re-run yet
 * for these operations.
 */

export type SfProjectStatus = 'ACTIVE' | 'ARCHIVED';

export type SfTaskStatus =
  | 'BACKLOG'
  | 'TODO'
  | 'IN_PROGRESS'
  | 'DONE'
  | 'CANCELLED';

export type SfTaskPriority = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export const SF_TASK_STATUSES: readonly SfTaskStatus[] = [
  'BACKLOG',
  'TODO',
  'IN_PROGRESS',
  'DONE',
  'CANCELLED',
];

export const SF_TASK_PRIORITIES: readonly SfTaskPriority[] = [
  'NONE',
  'LOW',
  'MEDIUM',
  'HIGH',
  'URGENT',
];

export interface SfProjectDto {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  status: SfProjectStatus;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface SfTaskDto {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: SfTaskStatus;
  priority: SfTaskPriority;
  dueAt: string | null;
  listSortOrder: number;
  assigneeUserId: string | null;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSfProjectInput {
  name: string;
  description?: string | null;
  sortOrder?: number | null;
}

export interface CreateSfTaskInput {
  title: string;
  description?: string | null;
  status?: SfTaskStatus;
  priority?: SfTaskPriority;
  dueAt?: string | null;
  listSortOrder?: number | null;
  assigneeUserId?: string | null;
}
