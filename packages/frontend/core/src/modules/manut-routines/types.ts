/**
 * Local Manut Routines DTOs.
 *
 * Mirrors `MnRoutineObjectType` / `MnRoutineRunObjectType` and the input
 * shapes from the backend (`packages/backend/server/src/plugins/manut/
 * manut-routine.dto.ts` + `manut-routine.resolver.ts`) so the Routines
 * page can ship before `@affine/graphql` regenerates an upstream-aware
 * codegen result. Same pattern as `modules/manut-reminders/types.ts`.
 */

export type MnRoutineVisibility = 'PERSONAL' | 'WORKSPACE_SHARED';
export type MnRoutineStatus = 'ACTIVE' | 'PAUSED' | 'ERROR';
export type MnRoutineRunTrigger = 'MANUAL' | 'SCHEDULED' | 'MCP';
export type MnRoutineRunStatus =
  | 'QUEUED'
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELLED';

export interface MnRoutineDto {
  id: string;
  workspaceId: string;
  ownerId: string;
  visibility: MnRoutineVisibility;
  name: string;
  description: string | null;
  prompt: string;
  cronSchedule: string | null;
  timezone: string | null;
  status: MnRoutineStatus;
  lastRunAt: string | null;
  nextRunAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MnRoutineRunDto {
  id: string;
  routineId: string;
  triggeredBy: string | null;
  triggerType: MnRoutineRunTrigger;
  status: MnRoutineRunStatus;
  output: string | null;
  errorMessage: string | null;
  durationMs: number | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
}

export interface CreateMnRoutineInput {
  name: string;
  description?: string | null;
  prompt: string;
  cronSchedule?: string | null;
  timezone?: string | null;
  visibility?: MnRoutineVisibility;
}

export interface UpdateMnRoutineInput {
  name?: string;
  description?: string | null;
  prompt?: string;
  cronSchedule?: string | null;
  timezone?: string | null;
  visibility?: MnRoutineVisibility;
  status?: MnRoutineStatus;
}
