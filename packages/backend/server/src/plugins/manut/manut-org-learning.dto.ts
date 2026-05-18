import {
  Field,
  GraphQLISODateTime,
  ID,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import { MnSkillSource } from '@prisma/client';

/**
 * M16 — Automatic Organizational Learning GraphQL surface.
 *
 * The contract lives on top of existing `MnSkill` rows: candidate
 * playbooks are stored as `MnSkill` with `source=IMPORTED` and an
 * HTML-comment marker block appended to `contentMd`:
 *
 *     <!-- mn-learning-candidate: {"sourceTaskId":"...","status":"pending"} -->
 *
 * No new table, no schema change. The marker is parsed back into the
 * GraphQL object below via {@link MnLearningCandidateObjectType}.
 *
 * CLAUDE.md scars honored:
 *  - Every nullable `@Field` uses the explicit `() => Type` form. The
 *    v1.7.0 / v1.10.2 NestJS `UndefinedTypeError` family of crashes
 *    showed up exactly when a nullable field shipped without the
 *    explicit type arrow. Annotations are the source of truth — TS
 *    union types are not visible to NestJS reflection at runtime.
 *  - `MnSkillSource` is a RUNTIME enum import so `registerEnumType`
 *    can see the actual value bag, not a stripped type alias.
 */

export enum MnLearningCandidateStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

registerEnumType(MnLearningCandidateStatus, {
  name: 'MnLearningCandidateStatus',
  description:
    'Lifecycle state for an auto-extracted playbook. PENDING means ' +
    'awaiting operator review; APPROVED means promoted to a real skill ' +
    '(the row remains source=IMPORTED to preserve provenance); REJECTED ' +
    'means archived without promotion.',
});

@ObjectType('MnLearningCandidate')
export class MnLearningCandidateObjectType {
  @Field(() => ID, {
    description:
      'The underlying MnSkill.id of the candidate row. Approving / ' +
      'rejecting a candidate operates on this id.',
  })
  id!: string;

  @Field(() => ID)
  workspaceId!: string;

  @Field(() => String)
  slug!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String, {
    nullable: true,
    description:
      'Short summary of the playbook body. Mirrors MnSkill.description ' +
      'so an approving operator can scan the list without opening every row.',
  })
  description!: string | null;

  @Field(() => String, {
    description:
      'The proposed playbook body in Markdown. Includes the ' +
      'mn-learning-candidate marker block as a trailing HTML comment ' +
      'so a round-trip back into the candidate list stays deterministic.',
  })
  body!: string;

  @Field(() => String, {
    nullable: true,
    description:
      'Task id that triggered this extraction. SetNull on task delete ' +
      'so a candidate survives the task being purged. Surfaces as null ' +
      'when the source task is no longer resolvable.',
  })
  sourceTaskId!: string | null;

  @Field(() => MnLearningCandidateStatus)
  status!: MnLearningCandidateStatus;

  @Field(() => MnSkillSource)
  source!: MnSkillSource;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt!: Date;
}

/**
 * Stable shape passed into the prompt template that produces a
 * playbook candidate. The service exposes a hook
 * (`runPlaybookExtractionPrompt`) the test suite can override so unit
 * tests never make a real model call but can still assert on the
 * structure of the input that WOULD have gone to a model.
 *
 * This is intentionally NOT a GraphQL type — it's a structural
 * interface used at the service edge.
 */
export interface PlaybookExtractionPromptInput {
  readonly taskId: string;
  readonly workspaceId: string;
  readonly projectId: string;
  readonly title: string;
  readonly description: string | null;
  readonly definitionOfDone: unknown;
  readonly relatedMemorySnippets: ReadonlyArray<{
    readonly kind: string;
    readonly contentMd: string;
  }>;
  readonly recentActivityActions: ReadonlyArray<{
    readonly action: string;
    readonly createdAt: string;
  }>;
}

/**
 * The structural result a prompt template is expected to return. The
 * service unwraps this into the candidate `MnSkill` shape.
 */
export interface PlaybookExtractionPromptOutput {
  readonly slug: string;
  readonly name: string;
  readonly body: string;
  readonly observations: ReadonlyArray<string>;
}
