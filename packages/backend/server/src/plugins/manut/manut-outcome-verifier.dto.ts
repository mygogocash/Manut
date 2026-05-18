import {
  Field,
  ID,
  InputType,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-scalars';
import { z } from 'zod';

/**
 * M11 — Enforced Outcomes DTOs.
 *
 * Predicates are a tagged union persisted as `MnTask.definitionOfDone`
 * (JSONB column). Each predicate carries a `kind` discriminant and
 * kind-specific fields. The Zod schemas below are the single source of
 * truth for shape validation — the resolver runs them on every write
 * and the service trusts already-validated rows on read.
 *
 * GraphQL-side, predicates are exposed as `GraphQLJSON` for two
 * reasons:
 *  1. GraphQL unions cannot express discriminated-input unions
 *     ergonomically; modelling each predicate as its own InputType
 *     and the union as an oneOf would balloon the schema.
 *  2. The Zod layer is already the validation choke point; piping the
 *     same shape through GraphQL @InputType wouldn't add safety.
 *
 * Per CLAUDE.md §6 UndefinedTypeError trap (v1.7.0 + v1.10.2 scars):
 * every nullable `@Field` carries an explicit `() => Type`.
 */

// ---------------------------------------------------------------------------
// Predicate kind enum (also exposed on GraphQL for filter/aggregation).
// ---------------------------------------------------------------------------

export enum MnDoDPredicateKind {
  DOC_EXISTS = 'DOC_EXISTS',
  URL_REACHABLE = 'URL_REACHABLE',
  WORK_PRODUCT_EXISTS = 'WORK_PRODUCT_EXISTS',
  EMBEDDING_SIMILARITY = 'EMBEDDING_SIMILARITY',
  CUSTOM = 'CUSTOM',
}

registerEnumType(MnDoDPredicateKind, {
  name: 'MnDoDPredicateKind',
  description:
    'M11 — Predicate kind for Definition of Done. Each kind has its ' +
    'own verifier path in MnOutcomeVerifierService.',
});

// ---------------------------------------------------------------------------
// Zod schemas — the validation source of truth.
// ---------------------------------------------------------------------------

const docExistsPredicateSchema = z.object({
  kind: z.literal(MnDoDPredicateKind.DOC_EXISTS),
  docId: z.string().min(1, 'docId must be non-empty'),
});

const urlReachablePredicateSchema = z.object({
  kind: z.literal(MnDoDPredicateKind.URL_REACHABLE),
  url: z
    .string()
    .min(1, 'url must be non-empty')
    .refine(
      value => {
        try {
          const parsed = new URL(value);
          return parsed.protocol === 'http:' || parsed.protocol === 'https:';
        } catch {
          return false;
        }
      },
      { message: 'url must be a valid http(s) URL' }
    ),
  expectedStatus: z.number().int().min(100).max(599).optional(),
});

const workProductExistsPredicateSchema = z.object({
  kind: z.literal(MnDoDPredicateKind.WORK_PRODUCT_EXISTS),
  taskId: z.string().min(1, 'taskId must be non-empty'),
  productKind: z.string().min(1).optional(),
});

const embeddingSimilarityPredicateSchema = z.object({
  kind: z.literal(MnDoDPredicateKind.EMBEDDING_SIMILARITY),
  sourceText: z.string().min(1, 'sourceText must be non-empty'),
  threshold: z
    .number()
    .min(0, 'threshold must be in [0, 1]')
    .max(1, 'threshold must be in [0, 1]'),
});

const customPredicateSchema = z.object({
  kind: z.literal(MnDoDPredicateKind.CUSTOM),
  description: z.string().min(1, 'description must be non-empty'),
});

export const MnDoDPredicateSchema = z.discriminatedUnion('kind', [
  docExistsPredicateSchema,
  urlReachablePredicateSchema,
  workProductExistsPredicateSchema,
  embeddingSimilarityPredicateSchema,
  customPredicateSchema,
]);

export const MnDoDPredicateListSchema = z
  .array(MnDoDPredicateSchema)
  .max(32, 'a single task may not declare more than 32 predicates');

export type MnDoDPredicate = z.infer<typeof MnDoDPredicateSchema>;
export type MnDoDDocExistsPredicate = z.infer<typeof docExistsPredicateSchema>;
export type MnDoDUrlReachablePredicate = z.infer<
  typeof urlReachablePredicateSchema
>;
export type MnDoDWorkProductExistsPredicate = z.infer<
  typeof workProductExistsPredicateSchema
>;
export type MnDoDEmbeddingSimilarityPredicate = z.infer<
  typeof embeddingSimilarityPredicateSchema
>;
export type MnDoDCustomPredicate = z.infer<typeof customPredicateSchema>;

// ---------------------------------------------------------------------------
// GraphQL output types.
// ---------------------------------------------------------------------------

/**
 * One predicate's verification outcome. `predicate` is the same JSON
 * shape that was stored on `MnTask.definitionOfDone`. `evidence` is a
 * free-form JSON blob the predicate runner can return — e.g. the HTTP
 * status code for URL_REACHABLE, or the doc title for DOC_EXISTS.
 */
@ObjectType('MnDoDPredicateResult')
export class MnDoDPredicateResultObjectType {
  @Field(() => GraphQLJSON)
  predicate!: MnDoDPredicate;

  @Field(() => Boolean)
  satisfied!: boolean;

  @Field(() => MnDoDPredicateKind)
  kind!: MnDoDPredicateKind;

  @Field(() => GraphQLJSON, { nullable: true })
  evidence!: Record<string, unknown> | null;

  @Field(() => String, { nullable: true })
  reason!: string | null;
}

/**
 * Aggregate verification result returned by
 * `verifyMnTaskDone(taskId)`. `satisfied` is the AND of every
 * predicate's result. `results` carries the per-predicate breakdown
 * so the UI can show "3 of 4 satisfied" with friendly reasons.
 */
@ObjectType('MnDoDVerificationResult')
export class MnDoDVerificationResultObjectType {
  @Field(() => ID)
  taskId!: string;

  @Field(() => Boolean)
  satisfied!: boolean;

  @Field(() => [MnDoDPredicateResultObjectType])
  results!: MnDoDPredicateResultObjectType[];

  @Field(() => Boolean)
  hasDefinition!: boolean;
}

// ---------------------------------------------------------------------------
// GraphQL input type for setMnTaskDefinitionOfDone.
// ---------------------------------------------------------------------------

@InputType('SetMnTaskDefinitionOfDoneInput')
export class SetMnTaskDefinitionOfDoneInput {
  @Field(() => ID)
  taskId!: string;

  /**
   * Array of typed predicates. Pass `null` (or an empty array) to
   * clear the DoD and remove the transition guard. The shape is
   * validated by `MnDoDPredicateListSchema` in the resolver — a
   * malformed predicate raises BadRequestException with the Zod
   * error message before any DB write.
   */
  @Field(() => GraphQLJSON, { nullable: true })
  predicates!: MnDoDPredicate[] | null;
}
