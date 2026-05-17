import {
  Field,
  GraphQLISODateTime,
  ID,
  InputType,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import { MnSkillSource } from '@prisma/client';
import { z } from 'zod';

/**
 * M5 skill layer GraphQL + Zod surface.
 *
 * EVERY nullable @Field uses the explicit `() => Type` form because
 * NestJS reflection cannot infer GraphQL types from TS unions that
 * include `null`. Shipping `@Field({ nullable: true })` without the
 * type arrow crashes the server on startup (v1.7.0 + v1.10.2 scars,
 * CLAUDE.md §6). Keep it explicit.
 */

registerEnumType(MnSkillSource, {
  name: 'MnSkillSource',
  description:
    'Provenance of an MnSkill row. BUILTIN is reserved for seed skills, ' +
    'WORKSPACE is created by an end user, and IMPORTED was created by ' +
    'the AGENTS.md import flow (Branch B / M5.2).',
});

const SLUG_MAX = 200;
const NAME_MAX = 200;
const DESCRIPTION_MAX = 2000;
const CONTENT_MAX = 200_000;
const VERSION_MAX = 64;

/**
 * Slug shape: lowercase ASCII letters / digits / hyphens, optionally
 * dotted (so users can express namespaces like `team.docs.review`).
 * Anchoring this in Zod keeps the resolver layer thin and avoids
 * surprising routes when the slug surfaces in URLs.
 */
const SLUG_PATTERN = /^[a-z0-9]+(?:[-.][a-z0-9]+)*$/;

/**
 * Semver-ish version. Service-enforced bump rule applies regardless of
 * the exact format (e.g. `1.2.3`, `2025.05.17`, `v3-beta`) — what matters
 * is that the string differs when `contentMd` differs.
 */
const VERSION_PATTERN = /^[A-Za-z0-9._+-]+$/;

// ---------------------------------------------------------------------------
// Zod schemas — the source of truth at the service boundary.
// ---------------------------------------------------------------------------

export const CreateMnSkillSchema = z.object({
  slug: z.string().min(1).max(SLUG_MAX).regex(SLUG_PATTERN, {
    message:
      'slug must be lowercase alphanumeric with optional - or . separators',
  }),
  name: z.string().min(1).max(NAME_MAX),
  description: z.string().max(DESCRIPTION_MAX).nullable().optional(),
  contentMd: z.string().min(1).max(CONTENT_MAX),
  version: z.string().min(1).max(VERSION_MAX).regex(VERSION_PATTERN, {
    message: 'version must use [A-Za-z0-9._+-] characters only',
  }),
  source: z.nativeEnum(MnSkillSource).nullable().optional(),
});

export type CreateMnSkillValues = z.infer<typeof CreateMnSkillSchema>;

export const UpdateMnSkillSchema = z.object({
  name: z.string().min(1).max(NAME_MAX).nullable().optional(),
  description: z.string().max(DESCRIPTION_MAX).nullable().optional(),
  contentMd: z.string().min(1).max(CONTENT_MAX).nullable().optional(),
  version: z
    .string()
    .min(1)
    .max(VERSION_MAX)
    .regex(VERSION_PATTERN, {
      message: 'version must use [A-Za-z0-9._+-] characters only',
    })
    .nullable()
    .optional(),
});

export type UpdateMnSkillValues = z.infer<typeof UpdateMnSkillSchema>;

// ---------------------------------------------------------------------------
// GraphQL @InputType / @ObjectType — wrap the Zod shapes.
// ---------------------------------------------------------------------------

@InputType('CreateMnSkillInput')
export class CreateMnSkillInput {
  @Field(() => String)
  slug!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String, { nullable: true })
  description?: string | null;

  @Field(() => String)
  contentMd!: string;

  @Field(() => String)
  version!: string;

  @Field(() => MnSkillSource, { nullable: true })
  source?: MnSkillSource | null;
}

@InputType('UpdateMnSkillInput')
export class UpdateMnSkillInput {
  @Field(() => String, { nullable: true })
  name?: string | null;

  @Field(() => String, { nullable: true })
  description?: string | null;

  @Field(() => String, { nullable: true })
  contentMd?: string | null;

  @Field(() => String, { nullable: true })
  version?: string | null;
}

@ObjectType('MnSkill')
export class MnSkillObjectType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  workspaceId!: string;

  @Field(() => String)
  slug!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String, { nullable: true })
  description!: string | null;

  @Field(() => String)
  contentMd!: string;

  @Field(() => String)
  version!: string;

  @Field(() => MnSkillSource)
  source!: MnSkillSource;

  @Field(() => GraphQLISODateTime, { nullable: true })
  archivedAt!: Date | null;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt!: Date;
}
