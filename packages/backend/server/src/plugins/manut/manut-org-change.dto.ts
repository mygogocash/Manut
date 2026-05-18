import {
  Field,
  GraphQLISODateTime,
  ID,
  InputType,
  Int,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import { MnOrgChangeStatus, MnOrgChangeType } from '@prisma/client';
import { GraphQLJSONObject } from 'graphql-scalars';
import { z } from 'zod';

/**
 * M15 self-organization GraphQL + Zod surface.
 *
 * CLAUDE.md scars honored:
 *  - EVERY nullable @Field uses the explicit `() => Type` form. NestJS
 *    reflection cannot infer GraphQL types from TS unions that include
 *    `null` — shipping `@Field({ nullable: true })` without the type
 *    arrow has crashed prod twice (v1.7.0 + v1.10.2; see CLAUDE.md §6).
 *  - Prisma enums (`MnOrgChangeType`, `MnOrgChangeStatus`) are RUNTIME
 *    imports (NOT `import type`); they're used at runtime by
 *    `registerEnumType` and the Zod schema (v1.12.0 DI scar pattern).
 */

registerEnumType(MnOrgChangeType, {
  name: 'MnOrgChangeType',
  description:
    'Kind of structural change proposed by an agent: role adjustment, ' +
    'delegation change, new routine, hire proposal, reporting change, ' +
    'or capability grant.',
});

registerEnumType(MnOrgChangeStatus, {
  name: 'MnOrgChangeStatus',
  description:
    'Lifecycle state of an org-change proposal: PROPOSED -> APPROVED' +
    '|REJECTED -> APPLIED -> REVERTED.',
});

const RATIONALE_MAX = 8000;
const DECISION_NOTE_MAX = 4000;

// ---------------------------------------------------------------------------
// Zod schemas — the source of truth at the service boundary.
// ---------------------------------------------------------------------------

export const ProposeMnOrgChangeSchema = z.object({
  projectId: z.string().min(1),
  type: z.nativeEnum(MnOrgChangeType),
  payload: z.record(z.string(), z.unknown()),
  rationale: z.string().min(1).max(RATIONALE_MAX),
  proposedByAgentId: z.string().min(1).nullable().optional(),
});

export type ProposeMnOrgChangeValues = z.infer<typeof ProposeMnOrgChangeSchema>;

/**
 * Decide schema. PROPOSED is rejected at the service layer — it's the
 * starting state, never a legal write target. APPROVED / REJECTED are
 * the two terminal-decision states; APPLIED / REVERTED are reachable
 * only via `apply()` / `revert()`.
 */
export const DecideMnOrgChangeSchema = z.object({
  status: z.nativeEnum(MnOrgChangeStatus),
  decisionNote: z.string().max(DECISION_NOTE_MAX).nullable().optional(),
});

export type DecideMnOrgChangeValues = z.infer<typeof DecideMnOrgChangeSchema>;

// ---------------------------------------------------------------------------
// GraphQL @InputType / @ObjectType — wrap the Zod shapes.
// ---------------------------------------------------------------------------

@InputType('ProposeMnOrgChangeInput')
export class ProposeMnOrgChangeInput {
  @Field(() => ID)
  projectId!: string;

  @Field(() => MnOrgChangeType)
  type!: MnOrgChangeType;

  @Field(() => GraphQLJSONObject, {
    description:
      'Type-specific payload. For DELEGATION_CHANGE: { agentId, ' +
      'newReportsToAgentId }. For NEW_ROUTINE: { name, prompt, ' +
      'cronSchedule?, timezone? }. See enum docs in schema.prisma.',
  })
  payload!: Record<string, unknown>;

  @Field(() => String, {
    description:
      'Free-form rationale explaining why this change is being ' +
      'proposed. Surfaced verbatim to the deciding operator.',
  })
  rationale!: string;

  @Field(() => ID, {
    nullable: true,
    description:
      'Optional agent id that proposed the change. Null when a human ' +
      'authored it directly via the org-changes inbox.',
  })
  proposedByAgentId?: string | null;
}

@InputType('DecideMnOrgChangeInput')
export class DecideMnOrgChangeInput {
  @Field(() => MnOrgChangeStatus, {
    description:
      'Decision: APPROVED or REJECTED. PROPOSED is not a legal write ' +
      'target; APPLIED / REVERTED are reachable only via apply() / revert().',
  })
  status!: MnOrgChangeStatus;

  @Field(() => String, {
    nullable: true,
    description:
      'Free-text note explaining the decision. Surfaced to the ' +
      'proposing agent so it can react.',
  })
  decisionNote?: string | null;
}

@InputType('ListMnOrgChangesInput')
export class ListMnOrgChangesInput {
  @Field(() => ID, { nullable: true })
  projectId?: string | null;

  @Field(() => [MnOrgChangeStatus], { nullable: true })
  statuses?: MnOrgChangeStatus[] | null;

  @Field(() => [MnOrgChangeType], { nullable: true })
  types?: MnOrgChangeType[] | null;

  @Field(() => ID, { nullable: true })
  proposedByAgentId?: string | null;

  @Field(() => Int, {
    nullable: true,
    description: 'Maximum rows to return. Defaults to 100; clamped to 500.',
  })
  limit?: number | null;
}

@ObjectType('MnOrgChange')
export class MnOrgChangeObjectType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  workspaceId!: string;

  @Field(() => ID)
  projectId!: string;

  @Field(() => MnOrgChangeType)
  type!: MnOrgChangeType;

  @Field(() => ID, { nullable: true })
  proposedByAgentId!: string | null;

  @Field(() => MnOrgChangeStatus)
  status!: MnOrgChangeStatus;

  @Field(() => GraphQLJSONObject)
  payload!: Record<string, unknown>;

  @Field(() => String)
  rationale!: string;

  @Field(() => String, { nullable: true })
  decisionNote!: string | null;

  @Field(() => ID, { nullable: true })
  decidedByUserId!: string | null;

  @Field(() => GraphQLISODateTime, { nullable: true })
  decidedAt!: Date | null;

  @Field(() => GraphQLISODateTime, { nullable: true })
  appliedAt!: Date | null;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;
}
