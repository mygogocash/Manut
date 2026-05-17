import {
  Field,
  GraphQLISODateTime,
  ID,
  InputType,
  Int,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import { MnGoalLevel, MnGoalStatus } from '@prisma/client';
import { z } from 'zod';

/**
 * M2 goal hierarchy GraphQL + Zod surface.
 *
 * EVERY nullable @Field uses the explicit `() => Type` form because
 * NestJS reflection cannot infer GraphQL types from TS unions that
 * include `null`. Shipping `@Field({ nullable: true })` without the
 * type arrow crashes the server on startup (v1.7.0 + v1.10.2 scars,
 * CLAUDE.md §6). Keep it explicit.
 */

registerEnumType(MnGoalLevel, {
  name: 'MnGoalLevel',
  description:
    'Where in the strategy chain a goal sits. PROJECT > TEAM > AGENT > TASK.',
});

registerEnumType(MnGoalStatus, {
  name: 'MnGoalStatus',
  description: 'Lifecycle state of a Manut goal.',
});

const TITLE_MAX = 200;
const DESCRIPTION_MAX = 4000;

/**
 * Max levels we'll ever walk when resolving a goal ancestry chain (or
 * the parent walker in cycle detection). PROJECT > TEAM > AGENT > TASK
 * plus one flex slot for product-defined sub-levels. Deeper chains hit
 * BadRequestException — context injection (capped at 500 chars) makes
 * deeper hierarchies more confusing than useful in practice.
 */
export const MAX_GOAL_CHAIN_DEPTH = 5;

/**
 * Max levels we'll walk when resolving task ancestry (parentTaskId
 * chain). Mirrors the goal limit so context-injection stays bounded.
 */
export const MAX_TASK_CHAIN_DEPTH = 8;

/**
 * Hard cap on the GOAL CONTEXT block prepended to AI system messages.
 * Tighter than the prompt itself — leaves headroom for the rest of the
 * system message and prevents a deep chain from monopolising the prompt
 * budget. See `MnGoalContextService.buildContext`.
 */
export const GOAL_CONTEXT_CHAR_CAP = 500;

// ---------------------------------------------------------------------------
// Zod schemas — the source of truth at the service boundary.
// ---------------------------------------------------------------------------

export const CreateMnGoalSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(1).max(TITLE_MAX),
  description: z.string().max(DESCRIPTION_MAX).nullable().optional(),
  level: z.nativeEnum(MnGoalLevel),
  parentGoalId: z.string().min(1).nullable().optional(),
  ownerAgentId: z.string().min(1).nullable().optional(),
  status: z.nativeEnum(MnGoalStatus).nullable().optional(),
});

export type CreateMnGoalValues = z.infer<typeof CreateMnGoalSchema>;

export const UpdateMnGoalSchema = z.object({
  title: z.string().min(1).max(TITLE_MAX).nullable().optional(),
  description: z.string().max(DESCRIPTION_MAX).nullable().optional(),
  level: z.nativeEnum(MnGoalLevel).nullable().optional(),
  parentGoalId: z.string().min(1).nullable().optional(),
  ownerAgentId: z.string().min(1).nullable().optional(),
  status: z.nativeEnum(MnGoalStatus).nullable().optional(),
});

export type UpdateMnGoalValues = z.infer<typeof UpdateMnGoalSchema>;

// ---------------------------------------------------------------------------
// GraphQL @InputType / @ObjectType — wrap the Zod shapes.
// ---------------------------------------------------------------------------

@InputType('CreateMnGoalInput')
export class CreateMnGoalInput {
  @Field(() => ID)
  projectId!: string;

  @Field(() => String)
  title!: string;

  @Field(() => String, { nullable: true })
  description?: string | null;

  @Field(() => MnGoalLevel)
  level!: MnGoalLevel;

  @Field(() => ID, { nullable: true })
  parentGoalId?: string | null;

  @Field(() => ID, { nullable: true })
  ownerAgentId?: string | null;

  @Field(() => MnGoalStatus, { nullable: true })
  status?: MnGoalStatus | null;
}

@InputType('UpdateMnGoalInput')
export class UpdateMnGoalInput {
  @Field(() => String, { nullable: true })
  title?: string | null;

  @Field(() => String, { nullable: true })
  description?: string | null;

  @Field(() => MnGoalLevel, { nullable: true })
  level?: MnGoalLevel | null;

  @Field(() => ID, { nullable: true })
  parentGoalId?: string | null;

  @Field(() => ID, { nullable: true })
  ownerAgentId?: string | null;

  @Field(() => MnGoalStatus, { nullable: true })
  status?: MnGoalStatus | null;
}

@ObjectType('MnGoal')
export class MnGoalObjectType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  workspaceId!: string;

  @Field(() => ID)
  projectId!: string;

  @Field(() => String)
  title!: string;

  @Field(() => String, { nullable: true })
  description!: string | null;

  @Field(() => MnGoalLevel)
  level!: MnGoalLevel;

  @Field(() => ID, { nullable: true })
  parentGoalId!: string | null;

  @Field(() => ID, { nullable: true })
  ownerAgentId!: string | null;

  @Field(() => MnGoalStatus)
  status!: MnGoalStatus;

  @Field(() => ID, { nullable: true })
  createdByUserId!: string | null;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt!: Date;
}

/**
 * One step in a goal ancestry walk — ordered root → leaf.
 */
@ObjectType('MnGoalAncestryStep')
export class MnGoalAncestryStep {
  @Field(() => ID)
  goalId!: string;

  @Field(() => MnGoalLevel)
  level!: MnGoalLevel;

  @Field(() => String)
  title!: string;

  @Field(() => MnGoalStatus)
  status!: MnGoalStatus;

  @Field(() => Int)
  depth!: number;
}

/**
 * Combined task + goal ancestry surface used by the task detail
 * breadcrumb. The arrays are ordered root → leaf so the renderer can
 * just `arr.map(...)` to produce the breadcrumb.
 */
@ObjectType('MnTaskAncestry')
export class MnTaskAncestry {
  @Field(() => ID)
  taskId!: string;

  @Field(() => String)
  taskTitle!: string;

  /** Ancestor tasks ordered root → leaf (excludes self). */
  @Field(() => [MnTaskAncestryStep])
  taskAncestors!: MnTaskAncestryStep[];

  /**
   * Goal chain reachable from this task (via goalId, then parentGoalId
   * walks). Ordered root → leaf. Empty when the task has no linked goal.
   */
  @Field(() => [MnGoalAncestryStep])
  goalChain!: MnGoalAncestryStep[];
}

@ObjectType('MnTaskAncestryStep')
export class MnTaskAncestryStep {
  @Field(() => ID)
  taskId!: string;

  @Field(() => String)
  title!: string;

  @Field(() => Int)
  depth!: number;
}

@InputType('AddMnTaskBlockerInput')
export class AddMnTaskBlockerInput {
  @Field(() => ID)
  taskId!: string;

  @Field(() => ID)
  blockedByTaskId!: string;
}

@ObjectType('MnTaskBlocker')
export class MnTaskBlockerObjectType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  taskId!: string;

  @Field(() => ID)
  blockedByTaskId!: string;

  @Field(() => ID)
  projectId!: string;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;
}
