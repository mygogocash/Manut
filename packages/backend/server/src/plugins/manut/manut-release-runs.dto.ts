import {
  Field,
  GraphQLISODateTime,
  ID,
  Int,
  ObjectType,
} from '@nestjs/graphql';

/**
 * Immutable record of a Manut release run, sourced from the handover
 * JSON payload that ships alongside every release / deploy via
 * scripts/manut-release-handover.mjs.
 *
 * Idempotency: a single (workspaceId, ghRunId) pair maps to exactly
 * one MnReleaseRun row. Re-importing the same handover updates the
 * existing row instead of inserting a duplicate. See
 * `MnReleaseRunsService.recordRunFromHandover`.
 *
 * Every nullable field uses an explicit `@Field(() => Type, { nullable: true })`
 * because NestJS metadata reflection cannot infer a GraphQL type from
 * `string | null` alone. Forgetting this caused the v1.10.2 production
 * UndefinedTypeError outage; see CLAUDE.md §5 for the full trap.
 */
@ObjectType('MnReleaseRun')
export class MnReleaseRunObjectType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  workspaceId!: string;

  @Field(() => String, {
    description:
      'GitHub Actions run identifier (workflow.runId from the handover).',
  })
  ghRunId!: string;

  @Field(() => String, { nullable: true })
  ghRunUrl!: string | null;

  @Field(() => String)
  mode!: string;

  @Field(() => String)
  status!: string;

  @Field(() => String, { nullable: true })
  version!: string | null;

  @Field(() => String, { nullable: true })
  shortSha!: string | null;

  @Field(() => String, { nullable: true })
  headSha!: string | null;

  @Field(() => String, { nullable: true })
  imageTag!: string | null;

  @Field(() => String, { nullable: true })
  imageDigest!: string | null;

  @Field(() => String, { nullable: true })
  registry!: string | null;

  @Field(() => String, { nullable: true })
  deployUrl!: string | null;

  @Field(() => String, { nullable: true })
  actor!: string | null;

  @Field(() => GraphQLISODateTime, { nullable: true })
  generatedAt!: Date | null;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt!: Date;
}

@ObjectType('MnReleaseTask')
export class MnReleaseTaskObjectType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  runId!: string;

  @Field(() => String, {
    description:
      'Stable slug for the task (build, verify, deploy, observe, document).',
  })
  slug!: string;

  @Field(() => String, {
    description:
      'Human-readable label copied verbatim from the handover taskTree.',
  })
  label!: string;

  @Field(() => Int)
  sortOrder!: number;
}
