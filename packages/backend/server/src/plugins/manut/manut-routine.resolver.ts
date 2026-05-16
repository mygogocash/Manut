import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { MnRoutineStatus } from '@prisma/client';

// Throttle decorator wrapping `@nestjs/throttler`. Pentest R3
// (post-Routines audit): runMnRoutine / createMnRoutine /
// updateMnRoutine were unthrottled, so a single user could fan out
// unbounded Vertex calls or schedule edits. We adopt the `'default'`
// named bucket the codebase already uses (see core/auth, payment,
// copilot resolvers) and tighten the per-user limit to 10/min on
// these three mutations. SkipThrottle is intentionally not used —
// these surfaces must be throttled.
import { Throttle } from '../../base';
import { CurrentUser } from '../../core/auth';
import {
  CreateMnRoutineInput,
  MnRoutineObjectType,
  MnRoutineRunObjectType,
  UpdateMnRoutineInput,
} from './manut-routine.dto';
import { MnRoutineService } from './manut-routine.service';

@Resolver()
export class MnRoutineResolver {
  constructor(private readonly routines: MnRoutineService) {}

  // ---------- Queries ----------

  @Query(() => [MnRoutineObjectType], {
    description:
      'List Manut routines visible to the current user in this workspace: personal routines they own plus all workspace-shared routines.',
  })
  async mnRoutines(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string
  ): Promise<MnRoutineObjectType[]> {
    const rows = await this.routines.listForUser(user.id, workspaceId);
    return rows.map(toRoutineDto);
  }

  @Query(() => MnRoutineObjectType, {
    description: 'Fetch a single Manut routine by id.',
  })
  async mnRoutine(
    @CurrentUser() user: CurrentUser,
    @Args('id', { type: () => ID }) id: string
  ): Promise<MnRoutineObjectType> {
    const row = await this.routines.getForUser(user.id, id);
    return toRoutineDto(row);
  }

  @Query(() => [MnRoutineRunObjectType], {
    description:
      'Recent execution history for a routine (default 30, max 200).',
  })
  async mnRoutineRuns(
    @CurrentUser() user: CurrentUser,
    @Args('routineId', { type: () => ID }) routineId: string,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number
  ): Promise<MnRoutineRunObjectType[]> {
    const rows = await this.routines.listRuns(user.id, routineId, limit ?? 30);
    return rows.map(toRunDto);
  }

  // ---------- Mutations ----------

  @Mutation(() => MnRoutineObjectType, {
    description:
      'Create a new routine (personal by default; admins can pick workspace-shared).',
  })
  @Throttle('default', { limit: 10 })
  async createMnRoutine(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('input') input: CreateMnRoutineInput
  ): Promise<MnRoutineObjectType> {
    const row = await this.routines.create(user.id, workspaceId, {
      name: input.name,
      description: input.description ?? null,
      prompt: input.prompt,
      cronSchedule: input.cronSchedule ?? null,
      timezone: input.timezone ?? null,
      visibility: input.visibility,
    });
    return toRoutineDto(row);
  }

  @Mutation(() => MnRoutineObjectType)
  @Throttle('default', { limit: 10 })
  async updateMnRoutine(
    @CurrentUser() user: CurrentUser,
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateMnRoutineInput
  ): Promise<MnRoutineObjectType> {
    const row = await this.routines.update(user.id, id, input);
    return toRoutineDto(row);
  }

  @Mutation(() => Boolean)
  async deleteMnRoutine(
    @CurrentUser() user: CurrentUser,
    @Args('id', { type: () => ID }) id: string
  ): Promise<boolean> {
    return this.routines.delete(user.id, id);
  }

  @Mutation(() => MnRoutineObjectType, {
    description: 'Pause a routine (no automatic scheduled runs until resumed).',
  })
  async pauseMnRoutine(
    @CurrentUser() user: CurrentUser,
    @Args('id', { type: () => ID }) id: string
  ): Promise<MnRoutineObjectType> {
    const row = await this.routines.setStatus(
      user.id,
      id,
      MnRoutineStatus.PAUSED
    );
    return toRoutineDto(row);
  }

  @Mutation(() => MnRoutineObjectType)
  async resumeMnRoutine(
    @CurrentUser() user: CurrentUser,
    @Args('id', { type: () => ID }) id: string
  ): Promise<MnRoutineObjectType> {
    const row = await this.routines.setStatus(
      user.id,
      id,
      MnRoutineStatus.ACTIVE
    );
    return toRoutineDto(row);
  }

  @Mutation(() => MnRoutineRunObjectType, {
    description:
      'Manually trigger a routine. PR 1 creates a QUEUED run record without executing — Vertex execution lands in PR 4.',
  })
  @Throttle('default', { limit: 10 })
  async runMnRoutine(
    @CurrentUser() user: CurrentUser,
    @Args('id', { type: () => ID }) id: string
  ): Promise<MnRoutineRunObjectType> {
    const row = await this.routines.createManualRun(user.id, id);
    return toRunDto(row);
  }
}

// ---------- DTO mappers (Prisma row → GraphQL object) ----------

import type { MnRoutine, MnRoutineRun } from '@prisma/client';

function toRoutineDto(row: MnRoutine): MnRoutineObjectType {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    ownerId: row.ownerId,
    visibility: row.visibility,
    name: row.name,
    description: row.description,
    prompt: row.prompt,
    cronSchedule: row.cronSchedule,
    timezone: row.timezone,
    status: row.status,
    lastRunAt: row.lastRunAt,
    // PR 1: no cron parser; nextRunAt is always null in v0 (matches the
    // manut-reminder convention; see DTO docstring).
    nextRunAt: null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toRunDto(row: MnRoutineRun): MnRoutineRunObjectType {
  return {
    id: row.id,
    routineId: row.routineId,
    triggeredBy: row.triggeredBy,
    triggerType: row.triggerType,
    status: row.status,
    output: row.output,
    errorMessage: row.errorMessage,
    durationMs: row.durationMs,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    createdAt: row.createdAt,
  };
}
