import {
  Field,
  GraphQLISODateTime,
  ID,
  InputType,
  Int,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import { MnApprovalStatus, MnApprovalType } from '@prisma/client';
import { GraphQLJSONObject } from 'graphql-scalars';
import { z } from 'zod';

/**
 * M3 approvals GraphQL + Zod surface.
 *
 * CLAUDE.md scars honored:
 *  - EVERY nullable @Field uses the explicit `() => Type` form because
 *    NestJS reflection cannot infer GraphQL types from TS unions that
 *    include `null`. Shipping `@Field({ nullable: true })` without the
 *    type arrow has crashed prod twice (v1.7.0 and v1.10.2 — see
 *    CLAUDE.md §6).
 *  - Prisma enums are RUNTIME imports, not `import type` — they're used
 *    at runtime by `registerEnumType` and the Zod schema.
 */

registerEnumType(MnApprovalType, {
  name: 'MnApprovalType',
  description:
    'Kind of approval request — hire-an-agent, mark-task-complete, override-budget, board-approval, tool-call-review, or org-change.',
});

registerEnumType(MnApprovalStatus, {
  name: 'MnApprovalStatus',
  description:
    'Lifecycle state of an approval. PENDING/REVISION_REQUESTED are mutable; APPROVED/REJECTED/CANCELLED are terminal.',
});

const DECISION_NOTE_MAX = 4000;
const COMMENT_BODY_MAX = 8000;

// ---------------------------------------------------------------------------
// Zod schemas — the source of truth at the service boundary.
// ---------------------------------------------------------------------------

export const CreateMnApprovalSchema = z.object({
  projectId: z.string().min(1),
  type: z.nativeEnum(MnApprovalType),
  payload: z.record(z.string(), z.unknown()).nullable().optional(),
  requestedByAgentId: z.string().min(1).nullable().optional(),
});

export type CreateMnApprovalValues = z.infer<typeof CreateMnApprovalSchema>;

/**
 * Decide input. The schema accepts ANY MnApprovalStatus value so the
 * inferred TS type lines up with the GraphQL input type (which uses
 * the full enum). Runtime validation in `manut-approval.service.ts`
 * rejects PENDING with a BadRequestException — PENDING is reachable
 * only via `create()` or `submitRevision()`, never as a decide target.
 */
export const DecideMnApprovalSchema = z.object({
  status: z.nativeEnum(MnApprovalStatus),
  decisionNote: z.string().max(DECISION_NOTE_MAX).nullable().optional(),
});

export type DecideMnApprovalValues = z.infer<typeof DecideMnApprovalSchema>;

export const CreateMnApprovalCommentSchema = z.object({
  body: z.string().min(1).max(COMMENT_BODY_MAX),
  authorAgentId: z.string().min(1).nullable().optional(),
});

export type CreateMnApprovalCommentValues = z.infer<
  typeof CreateMnApprovalCommentSchema
>;

// ---------------------------------------------------------------------------
// GraphQL @InputType / @ObjectType — wrap the Zod shapes.
// ---------------------------------------------------------------------------

@InputType('CreateMnApprovalInput')
export class CreateMnApprovalInput {
  @Field(() => ID)
  projectId!: string;

  @Field(() => MnApprovalType)
  type!: MnApprovalType;

  @Field(() => GraphQLJSONObject, {
    nullable: true,
    description:
      'Type-specific payload. For TOOL_CALL_REVIEW: { toolName, args, sessionId, agentId }. Free JSON otherwise.',
  })
  payload?: Record<string, unknown> | null;

  @Field(() => ID, {
    nullable: true,
    description:
      'Optional agent id that requested the approval. Null when a human requested it directly.',
  })
  requestedByAgentId?: string | null;
}

@InputType('DecideMnApprovalInput')
export class DecideMnApprovalInput {
  @Field(() => MnApprovalStatus, {
    description:
      'Decision: APPROVED, REJECTED, CANCELLED, or REVISION_REQUESTED. PENDING is not a legal write target.',
  })
  status!: MnApprovalStatus;

  @Field(() => String, {
    nullable: true,
    description:
      'Free-text note explaining the decision. Surfaced to the requesting agent so it can react.',
  })
  decisionNote?: string | null;
}

@InputType('CreateMnApprovalCommentInput')
export class CreateMnApprovalCommentInput {
  @Field(() => String)
  body!: string;

  @Field(() => ID, {
    nullable: true,
    description:
      'Optional agent id if the comment author is an agent. Null when authored by a human user.',
  })
  authorAgentId?: string | null;
}

@ObjectType('MnApproval')
export class MnApprovalObjectType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  workspaceId!: string;

  @Field(() => ID)
  projectId!: string;

  @Field(() => MnApprovalType)
  type!: MnApprovalType;

  @Field(() => ID, { nullable: true })
  requestedByAgentId!: string | null;

  @Field(() => ID, { nullable: true })
  requestedByUserId!: string | null;

  @Field(() => MnApprovalStatus)
  status!: MnApprovalStatus;

  @Field(() => GraphQLJSONObject)
  payload!: Record<string, unknown>;

  @Field(() => String, { nullable: true })
  decisionNote!: string | null;

  @Field(() => ID, { nullable: true })
  decidedByUserId!: string | null;

  @Field(() => GraphQLISODateTime, { nullable: true })
  decidedAt!: Date | null;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt!: Date;
}

@ObjectType('MnApprovalComment')
export class MnApprovalCommentObjectType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  approvalId!: string;

  @Field(() => ID)
  projectId!: string;

  @Field(() => ID, { nullable: true })
  authorAgentId!: string | null;

  @Field(() => ID, { nullable: true })
  authorUserId!: string | null;

  @Field(() => String)
  body!: string;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;
}

/**
 * Filter args for the approvals inbox. All fields optional so the
 * default surface is "everything in this workspace".
 */
@InputType('ListMnApprovalsInput')
export class ListMnApprovalsInput {
  @Field(() => ID, { nullable: true })
  projectId?: string | null;

  @Field(() => [MnApprovalStatus], { nullable: true })
  statuses?: MnApprovalStatus[] | null;

  @Field(() => [MnApprovalType], { nullable: true })
  types?: MnApprovalType[] | null;

  @Field(() => ID, { nullable: true })
  requestedByAgentId?: string | null;

  @Field(() => Int, {
    nullable: true,
    description: 'Maximum rows to return. Defaults to 100; clamped to 500.',
  })
  limit?: number | null;
}
