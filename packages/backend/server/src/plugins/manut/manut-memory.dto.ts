import {
  Field,
  GraphQLISODateTime,
  ID,
  InputType,
  Int,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import { MnMemoryKind } from '@prisma/client';
import { z } from 'zod';

/**
 * M9 memory layer GraphQL + Zod surface.
 *
 * EVERY nullable @Field uses the explicit `() => Type` form because
 * NestJS reflection cannot infer GraphQL types from TS unions that
 * include `null`. Shipping `@Field({ nullable: true })` without the
 * type arrow crashes the server on startup (v1.7.0 + v1.10.2 scars,
 * CLAUDE.md §6). Keep it explicit.
 */

registerEnumType(MnMemoryKind, {
  name: 'MnMemoryKind',
  description:
    'Kind of memory row. FACT is a statement of truth; DECISION is a ' +
    'recorded choice future runs should respect; OBSERVATION is a free-form ' +
    'note; PLAYBOOK is a reusable runbook fragment.',
});

const CONTENT_MAX = 50_000;
const IMPORTANCE_MIN = 1;
const IMPORTANCE_MAX = 10;
const EMBEDDING_DIMS = 1024;

// ---------------------------------------------------------------------------
// Zod schemas — the source of truth at the service boundary.
// ---------------------------------------------------------------------------

export const StoreMnAgentMemorySchema = z.object({
  workspaceId: z.string().min(1),
  projectId: z.string().min(1),
  agentId: z.string().min(1),
  taskId: z.string().min(1).nullable().optional(),
  kind: z.nativeEnum(MnMemoryKind),
  contentMd: z.string().min(1).max(CONTENT_MAX),
  importance: z
    .number()
    .int()
    .min(IMPORTANCE_MIN)
    .max(IMPORTANCE_MAX)
    .nullable()
    .optional(),
  embedding: z.array(z.number()).length(EMBEDDING_DIMS).nullable().optional(),
});

export type StoreMnAgentMemoryValues = z.infer<typeof StoreMnAgentMemorySchema>;

// ---------------------------------------------------------------------------
// GraphQL @InputType / @ObjectType — wrap the Zod shapes.
// ---------------------------------------------------------------------------

@InputType('StoreMnAgentMemoryInput')
export class StoreMnAgentMemoryInput {
  @Field(() => ID)
  workspaceId!: string;

  @Field(() => ID)
  projectId!: string;

  @Field(() => ID)
  agentId!: string;

  @Field(() => ID, { nullable: true })
  taskId?: string | null;

  @Field(() => MnMemoryKind)
  kind!: MnMemoryKind;

  @Field(() => String)
  contentMd!: string;

  @Field(() => Int, { nullable: true })
  importance?: number | null;
}

@ObjectType('MnAgentMemory')
export class MnAgentMemoryObjectType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  workspaceId!: string;

  @Field(() => ID)
  projectId!: string;

  @Field(() => ID)
  agentId!: string;

  @Field(() => ID, { nullable: true })
  taskId!: string | null;

  @Field(() => MnMemoryKind)
  kind!: MnMemoryKind;

  @Field(() => String)
  contentMd!: string;

  @Field(() => Int)
  retrievedCount!: number;

  @Field(() => GraphQLISODateTime, { nullable: true })
  lastRetrievedAt!: Date | null;

  @Field(() => Int)
  importance!: number;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt!: Date;
}

export { EMBEDDING_DIMS as MN_MEMORY_EMBEDDING_DIMS };
export { IMPORTANCE_MIN as MN_MEMORY_IMPORTANCE_MIN };
export { IMPORTANCE_MAX as MN_MEMORY_IMPORTANCE_MAX };
