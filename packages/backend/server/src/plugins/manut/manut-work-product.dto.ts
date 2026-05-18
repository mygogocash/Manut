import {
  Field,
  GraphQLISODateTime,
  ID,
  InputType,
  Int,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import { MnWorkProductKind } from '@prisma/client';
import { GraphQLJSONObject } from 'graphql-scalars';
import { z } from 'zod';

/**
 * M10 — Artifacts & Work Products GraphQL + Zod surface.
 *
 * EVERY nullable `@Field` uses the explicit `() => Type` form. NestJS
 * reflection cannot infer GraphQL types from TS unions that include
 * `null` — shipping `@Field({ nullable: true })` without the type
 * arrow crashes the server on startup (v1.7.0 + v1.10.2 scars,
 * CLAUDE.md §6). Keep it explicit even when the type is "obviously"
 * a string.
 */

registerEnumType(MnWorkProductKind, {
  name: 'MnWorkProductKind',
  description:
    'Kind of work product. DOC is an internal BlockSuite doc, FILE is a ' +
    'blob in object storage, URL is an external link, PR is a pull request, ' +
    'DEPLOYMENT is an environment rollout, CSV is a data export, SCREENSHOT ' +
    'is an image attachment. Free-form `metadata` JSON carries per-kind detail.',
});

const REF_MAX = 4096;
const TITLE_MAX = 512;
const DESCRIPTION_MAX = 4000;

// ---------------------------------------------------------------------------
// Zod schemas — the source of truth at the service boundary.
// ---------------------------------------------------------------------------

export const CreateMnWorkProductSchema = z.object({
  taskId: z.string().min(1),
  kind: z.nativeEnum(MnWorkProductKind),
  ref: z.string().min(1).max(REF_MAX),
  byteSize: z.number().int().nonnegative().nullable().optional(),
  title: z.string().max(TITLE_MAX).nullable().optional(),
  description: z.string().max(DESCRIPTION_MAX).nullable().optional(),
  producedByAgentId: z.string().min(1).nullable().optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
});

export type CreateMnWorkProductValues = z.infer<
  typeof CreateMnWorkProductSchema
>;

// ---------------------------------------------------------------------------
// GraphQL @InputType / @ObjectType — wrap the Zod shapes.
// ---------------------------------------------------------------------------

@InputType('CreateMnWorkProductInput')
export class CreateMnWorkProductInput {
  @Field(() => ID)
  taskId!: string;

  @Field(() => MnWorkProductKind)
  kind!: MnWorkProductKind;

  @Field(() => String)
  ref!: string;

  @Field(() => Int, { nullable: true })
  byteSize?: number | null;

  @Field(() => String, { nullable: true })
  title?: string | null;

  @Field(() => String, { nullable: true })
  description?: string | null;

  @Field(() => ID, { nullable: true })
  producedByAgentId?: string | null;

  @Field(() => GraphQLJSONObject, { nullable: true })
  metadata?: Record<string, unknown> | null;
}

@ObjectType('MnWorkProduct')
export class MnWorkProductObjectType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  workspaceId!: string;

  @Field(() => ID)
  projectId!: string;

  @Field(() => ID)
  taskId!: string;

  @Field(() => ID, { nullable: true })
  producedByAgentId!: string | null;

  @Field(() => MnWorkProductKind)
  kind!: MnWorkProductKind;

  @Field(() => String)
  ref!: string;

  @Field(() => Int, { nullable: true })
  byteSize!: number | null;

  @Field(() => String, { nullable: true })
  title!: string | null;

  @Field(() => String, { nullable: true })
  description!: string | null;

  @Field(() => GraphQLJSONObject)
  metadata!: Record<string, unknown>;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;
}
