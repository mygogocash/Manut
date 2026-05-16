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
// Mirrors the Prisma `MnRoutineRunStatus` enum exactly. There is no
// `CANCELLED` member — the backend never cancels a run mid-flight in v0;
// runs always reach SUCCESS / FAILED / TIMED_OUT or stay QUEUED forever
// if nothing consumed them. v1.x of PR #71 mis-typed this as `SUCCEEDED`
// + `CANCELLED`; corrected in PR 2 once the consumer started writing
// actual terminal states.
export type MnRoutineRunStatus =
  | 'QUEUED'
  | 'RUNNING'
  | 'SUCCESS'
  | 'FAILED'
  | 'TIMED_OUT';

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
