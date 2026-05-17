import {
  Field,
  GraphQLISODateTime,
  ID,
  InputType,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import {
  MnAgentAdapterType,
  MnAgentStatus,
  MnHeartbeatInvocationSource,
  MnHeartbeatRunStatus,
} from '@prisma/client';
import { GraphQLJSONObject } from 'graphql-scalars';
import { z } from 'zod';

/**
 * M1 agent identity GraphQL + Zod surface.
 *
 * EVERY nullable @Field uses the explicit `() => Type` form because
 * NestJS reflection cannot infer GraphQL types from TS unions that
 * include `null`. Shipping `@Field({ nullable: true })` without the
 * type arrow has crashed prod twice on this codebase (v1.7.0 and
 * v1.10.2 — see CLAUDE.md §6). Keep it explicit.
 */

registerEnumType(MnAgentAdapterType, {
  name: 'MnAgentAdapterType',
  description:
    'Which downstream runtime an agent talks to. M1 only ships Copilot chat sessions.',
});

registerEnumType(MnAgentStatus, {
  name: 'MnAgentStatus',
  description: 'Lifecycle state of a Manut agent.',
});

registerEnumType(MnHeartbeatInvocationSource, {
  name: 'MnHeartbeatInvocationSource',
  description: 'How an agent run was triggered.',
});

registerEnumType(MnHeartbeatRunStatus, {
  name: 'MnHeartbeatRunStatus',
  description: 'Terminal-or-in-flight status of an agent heartbeat run.',
});

const NAME_MAX = 200;
const CAPABILITIES_MAX = 2000;

// ---------------------------------------------------------------------------
// Zod schemas — the source of truth at the service boundary.
// ---------------------------------------------------------------------------

export const CreateMnAgentSchema = z.object({
  projectId: z.string().min(1),
  roleId: z.string().min(1).nullable().optional(),
  name: z.string().min(1).max(NAME_MAX),
  adapterType: z.nativeEnum(MnAgentAdapterType).nullable().optional(),
  adapterConfig: z.record(z.string(), z.unknown()).nullable().optional(),
  runtimeConfig: z.record(z.string(), z.unknown()).nullable().optional(),
  reportsToAgentId: z.string().min(1).nullable().optional(),
  capabilities: z.string().max(CAPABILITIES_MAX).nullable().optional(),
});

export type CreateMnAgentValues = z.infer<typeof CreateMnAgentSchema>;

export const UpdateMnAgentSchema = z.object({
  roleId: z.string().min(1).nullable().optional(),
  name: z.string().min(1).max(NAME_MAX).nullable().optional(),
  adapterType: z.nativeEnum(MnAgentAdapterType).nullable().optional(),
  adapterConfig: z.record(z.string(), z.unknown()).nullable().optional(),
  runtimeConfig: z.record(z.string(), z.unknown()).nullable().optional(),
  status: z.nativeEnum(MnAgentStatus).nullable().optional(),
  reportsToAgentId: z.string().min(1).nullable().optional(),
  capabilities: z.string().max(CAPABILITIES_MAX).nullable().optional(),
});

export type UpdateMnAgentValues = z.infer<typeof UpdateMnAgentSchema>;

export const MintMnAgentApiKeySchema = z.object({
  name: z.string().min(1).max(NAME_MAX),
});

export type MintMnAgentApiKeyValues = z.infer<typeof MintMnAgentApiKeySchema>;

// ---------------------------------------------------------------------------
// GraphQL @InputType / @ObjectType — wrap the Zod shapes.
// ---------------------------------------------------------------------------

@InputType('CreateMnAgentInput')
export class CreateMnAgentInput {
  @Field(() => ID)
  projectId!: string;

  @Field(() => ID, { nullable: true })
  roleId?: string | null;

  @Field(() => String)
  name!: string;

  @Field(() => MnAgentAdapterType, { nullable: true })
  adapterType?: MnAgentAdapterType | null;

  @Field(() => GraphQLJSONObject, { nullable: true })
  adapterConfig?: Record<string, unknown> | null;

  @Field(() => GraphQLJSONObject, { nullable: true })
  runtimeConfig?: Record<string, unknown> | null;

  @Field(() => ID, { nullable: true })
  reportsToAgentId?: string | null;

  @Field(() => String, { nullable: true })
  capabilities?: string | null;
}

@InputType('UpdateMnAgentInput')
export class UpdateMnAgentInput {
  @Field(() => ID, { nullable: true })
  roleId?: string | null;

  @Field(() => String, { nullable: true })
  name?: string | null;

  @Field(() => MnAgentAdapterType, { nullable: true })
  adapterType?: MnAgentAdapterType | null;

  @Field(() => GraphQLJSONObject, { nullable: true })
  adapterConfig?: Record<string, unknown> | null;

  @Field(() => GraphQLJSONObject, { nullable: true })
  runtimeConfig?: Record<string, unknown> | null;

  @Field(() => MnAgentStatus, { nullable: true })
  status?: MnAgentStatus | null;

  @Field(() => ID, { nullable: true })
  reportsToAgentId?: string | null;

  @Field(() => String, { nullable: true })
  capabilities?: string | null;
}

@ObjectType('MnAgent')
export class MnAgentObjectType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  workspaceId!: string;

  @Field(() => ID)
  projectId!: string;

  @Field(() => ID, { nullable: true })
  roleId!: string | null;

  @Field(() => String)
  name!: string;

  @Field(() => MnAgentAdapterType)
  adapterType!: MnAgentAdapterType;

  @Field(() => GraphQLJSONObject)
  adapterConfig!: Record<string, unknown>;

  @Field(() => GraphQLJSONObject)
  runtimeConfig!: Record<string, unknown>;

  @Field(() => MnAgentStatus)
  status!: MnAgentStatus;

  @Field(() => ID, { nullable: true })
  reportsToAgentId!: string | null;

  @Field(() => String, { nullable: true })
  capabilities!: string | null;

  @Field(() => GraphQLISODateTime, { nullable: true })
  lastHeartbeatAt!: Date | null;

  @Field(() => ID, { nullable: true })
  createdByUserId!: string | null;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt!: Date;
}

@InputType('MintMnAgentApiKeyInput')
export class MintMnAgentApiKeyInput {
  @Field(() => String, {
    description: 'Human-readable label for this key, shown in the key list.',
  })
  name!: string;
}

@ObjectType('MnAgentApiKey')
export class MnAgentApiKeyObjectType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  agentId!: string;

  @Field(() => ID)
  workspaceId!: string;

  @Field(() => ID)
  projectId!: string;

  @Field(() => String)
  name!: string;

  @Field(() => GraphQLISODateTime, { nullable: true })
  lastUsedAt!: Date | null;

  @Field(() => GraphQLISODateTime, { nullable: true })
  revokedAt!: Date | null;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;
}

/**
 * Returned ONCE on mint — the plaintext token is irrecoverable from
 * the server after this call returns. UI must surface it to the
 * operator immediately and tell them to store it somewhere safe.
 */
@ObjectType('MintedMnAgentApiKey')
export class MintedMnAgentApiKeyObjectType {
  @Field(() => MnAgentApiKeyObjectType)
  key!: MnAgentApiKeyObjectType;

  @Field(() => String, {
    description:
      'Plaintext API key. Shown ONCE — never recoverable from the server again.',
  })
  plaintext!: string;
}

@ObjectType('MnHeartbeatRun')
export class MnHeartbeatRunObjectType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  workspaceId!: string;

  @Field(() => ID)
  projectId!: string;

  @Field(() => ID)
  agentId!: string;

  @Field(() => MnHeartbeatInvocationSource)
  invocationSource!: MnHeartbeatInvocationSource;

  @Field(() => MnHeartbeatRunStatus)
  status!: MnHeartbeatRunStatus;

  @Field(() => ID, { nullable: true })
  aiSessionId!: string | null;

  @Field(() => GraphQLISODateTime)
  startedAt!: Date;

  @Field(() => GraphQLISODateTime, { nullable: true })
  finishedAt!: Date | null;

  @Field(() => String, { nullable: true })
  externalRunId!: string | null;

  @Field(() => String, { nullable: true })
  error!: string | null;
}
