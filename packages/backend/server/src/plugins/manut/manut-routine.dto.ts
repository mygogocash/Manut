import {
  Field,
  GraphQLISODateTime,
  ID,
  InputType,
  Int,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import {
  MnRoutineRunStatus,
  MnRoutineRunTrigger,
  MnRoutineStatus,
  MnRoutineVisibility,
} from '@prisma/client';

registerEnumType(MnRoutineVisibility, {
  name: 'MnRoutineVisibility',
  description:
    'Routine visibility: PERSONAL (only owner sees) or WORKSPACE_SHARED (any workspace member).',
});

registerEnumType(MnRoutineStatus, {
  name: 'MnRoutineStatus',
  description:
    'Routine lifecycle: ACTIVE (will run on schedule), PAUSED (no automatic runs), ERROR (last sync failed).',
});

registerEnumType(MnRoutineRunTrigger, {
  name: 'MnRoutineRunTrigger',
  description:
    'How a run was started: MANUAL (Run-now button), SCHEDULED (cron fired), MCP (Claude Code via MCP server).',
});

registerEnumType(MnRoutineRunStatus, {
  name: 'MnRoutineRunStatus',
  description: 'Lifecycle of a single run.',
});

@ObjectType('MnRoutine')
export class MnRoutineObjectType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  workspaceId!: string;

  @Field(() => ID)
  ownerId!: string;

  @Field(() => MnRoutineVisibility)
  visibility!: MnRoutineVisibility;

  @Field(() => String)
  name!: string;

  @Field(() => String, { nullable: true })
  description!: string | null;

  @Field(() => String)
  prompt!: string;

  @Field(() => String, { nullable: true })
  cronSchedule!: string | null;

  @Field(() => String, { nullable: true })
  timezone!: string | null;

  @Field(() => MnRoutineStatus)
  status!: MnRoutineStatus;

  @Field(() => GraphQLISODateTime, { nullable: true })
  lastRunAt!: Date | null;

  /**
   * Computed projection of when this routine's cron next fires.
   * Returns null in PR 1 — no cron parser is in deps yet and the
   * Anthropic scheduled-tasks sync (PR 2) is what'll populate this.
   * Frontend renders null as a dash.
   */
  @Field(() => GraphQLISODateTime, { nullable: true })
  nextRunAt!: Date | null;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt!: Date;
}

@ObjectType('MnRoutineRun')
export class MnRoutineRunObjectType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  routineId!: string;

  @Field(() => ID, { nullable: true })
  triggeredBy!: string | null;

  @Field(() => MnRoutineRunTrigger)
  triggerType!: MnRoutineRunTrigger;

  @Field(() => MnRoutineRunStatus)
  status!: MnRoutineRunStatus;

  @Field(() => String, { nullable: true })
  output!: string | null;

  @Field(() => String, { nullable: true })
  errorMessage!: string | null;

  @Field(() => Int, { nullable: true })
  durationMs!: number | null;

  @Field(() => GraphQLISODateTime, { nullable: true })
  startedAt!: Date | null;

  @Field(() => GraphQLISODateTime, { nullable: true })
  finishedAt!: Date | null;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;
}

@InputType()
export class CreateMnRoutineInput {
  @Field(() => String)
  name!: string;

  @Field(() => String, { nullable: true })
  description?: string | null;

  @Field(() => String)
  prompt!: string;

  @Field(() => String, { nullable: true })
  cronSchedule?: string | null;

  @Field(() => String, { nullable: true })
  timezone?: string | null;

  @Field(() => MnRoutineVisibility, { nullable: true })
  visibility?: MnRoutineVisibility;
}

@InputType()
export class UpdateMnRoutineInput {
  @Field(() => String, { nullable: true })
  name?: string;

  @Field(() => String, { nullable: true })
  description?: string | null;

  @Field(() => String, { nullable: true })
  prompt?: string;

  @Field(() => String, { nullable: true })
  cronSchedule?: string | null;

  @Field(() => String, { nullable: true })
  timezone?: string | null;

  @Field(() => MnRoutineVisibility, { nullable: true })
  visibility?: MnRoutineVisibility;

  @Field(() => MnRoutineStatus, { nullable: true })
  status?: MnRoutineStatus;
}
