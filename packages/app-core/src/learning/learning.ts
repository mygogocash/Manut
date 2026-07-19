import { z } from "zod";

import type { ApiClient } from "../api/api-client";
import type { RequestAbortSignal } from "../api/api-types";

const nullableText = z.string().nullable();

const paginationMetaSchema = z
  .object({
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  })
  .strict();

// List receipts strip raw storage fileUrl; complete/manage writes stay deferred.
const learningModuleApiSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    description: nullableText,
    category: z.string().min(1),
    duration: z.number().int().nonnegative().nullable(),
    url: nullableText.optional(),
    fileUrl: nullableText.optional(),
    fileName: nullableText.optional(),
    isMandatory: z.boolean(),
  })
  .passthrough();

export const learningModuleSchema = learningModuleApiSchema.transform(
  (module) => ({
    id: module.id,
    title: module.title,
    description: module.description,
    category: module.category,
    durationMinutes: module.duration,
    externalUrl: module.url ?? null,
    hasAttachment: Boolean(module.fileUrl),
    attachmentName: module.fileName ?? null,
    isMandatory: module.isMandatory,
  }),
);

const learningModulesResponseSchema = z
  .object({
    data: z.array(learningModuleSchema),
    meta: paginationMetaSchema,
  })
  .strict();

export const learningModuleListParamsSchema = z
  .object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(100).default(20),
    category: z.string().trim().min(1).optional(),
    search: z.string().trim().min(1).optional(),
  })
  .strict();

export type LearningModule = z.infer<typeof learningModuleSchema>;
export type LearningModuleListParams = z.input<
  typeof learningModuleListParamsSchema
>;
export type LearningModuleList = z.infer<typeof learningModulesResponseSchema>;

export const LEARNING_MODULES_QUERY_ROOT = ["learning", "modules"] as const;
export const LEARNING_COMPLETIONS_QUERY_ROOT = [
  "learning",
  "completions",
] as const;

export function learningModulesQueryKey(params: LearningModuleListParams = {}) {
  return [
    ...LEARNING_MODULES_QUERY_ROOT,
    learningModuleListParamsSchema.parse(params),
  ] as const;
}

const learningCompletionApiSchema = z
  .object({
    id: z.string().min(1),
    moduleId: z.string().min(1),
    employeeId: z.string().min(1),
    completedAt: z.string().min(1),
    score: z.number().int().min(0).max(100).nullable(),
    module: z
      .object({
        id: z.string().min(1),
        title: z.string().min(1),
        category: z.string().min(1),
      })
      .passthrough(),
    employee: z
      .object({
        id: z.string().min(1),
        name: z.string(),
        email: z.string(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export const learningCompletionSchema = learningCompletionApiSchema.transform(
  (completion) => ({
    id: completion.id,
    moduleId: completion.moduleId,
    completedAt: completion.completedAt,
    score: completion.score,
    moduleTitle: completion.module.title,
    moduleCategory: completion.module.category,
  }),
);

const learningCompletionsResponseSchema = z
  .object({
    data: z.array(learningCompletionSchema),
    meta: paginationMetaSchema,
  })
  .strict();

const learningCompletionResponseSchema = z
  .object({ data: learningCompletionSchema })
  .strict();

export const learningCompletionListParamsSchema = z
  .object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(100).default(20),
    moduleId: z.string().trim().min(1).optional(),
  })
  .strict();

export const markLearningCompleteInputSchema = z
  .object({
    moduleId: z.string().trim().min(1),
    score: z.number().int().min(0).max(100).optional(),
  })
  .strict();

export type LearningCompletion = z.infer<typeof learningCompletionSchema>;
export type LearningCompletionListParams = z.input<
  typeof learningCompletionListParamsSchema
>;
export type LearningCompletionList = z.infer<
  typeof learningCompletionsResponseSchema
>;
export type MarkLearningCompleteInput = z.input<
  typeof markLearningCompleteInputSchema
>;

export function learningCompletionsQueryKey(
  params: LearningCompletionListParams = {},
) {
  return [
    ...LEARNING_COMPLETIONS_QUERY_ROOT,
    learningCompletionListParamsSchema.parse(params),
  ] as const;
}

function encodeLearningQuery(
  params: z.output<typeof learningModuleListParamsSchema>,
): string {
  const entries: Array<[string, string | number | undefined]> = [
    ["page", params.page],
    ["limit", params.limit],
    ["category", params.category],
    ["search", params.search],
  ];
  return entries
    .filter(
      (entry): entry is [string, string | number] => entry[1] !== undefined,
    )
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`,
    )
    .join("&");
}

function encodeLearningCompletionQuery(
  params: z.output<typeof learningCompletionListParamsSchema>,
): string {
  const entries: Array<[string, string | number | undefined]> = [
    ["page", params.page],
    ["limit", params.limit],
    ["moduleId", params.moduleId],
  ];
  return entries
    .filter(
      (entry): entry is [string, string | number] => entry[1] !== undefined,
    )
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`,
    )
    .join("&");
}

export async function listLearningModules(
  client: ApiClient,
  params: LearningModuleListParams = {},
  signal?: RequestAbortSignal,
): Promise<LearningModuleList> {
  const query = encodeLearningQuery(learningModuleListParamsSchema.parse(params));
  const response = await client.get<unknown>(
    `/learning/modules?${query}`,
    signal ? { signal } : undefined,
  );
  return learningModulesResponseSchema.parse(response);
}

export async function listLearningCompletions(
  client: ApiClient,
  params: LearningCompletionListParams = {},
  signal?: RequestAbortSignal,
): Promise<LearningCompletionList> {
  const query = encodeLearningCompletionQuery(
    learningCompletionListParamsSchema.parse(params),
  );
  const response = await client.get<unknown>(
    `/learning/completions?${query}`,
    signal ? { signal } : undefined,
  );
  return learningCompletionsResponseSchema.parse(response);
}

export async function markLearningComplete(
  client: ApiClient,
  input: MarkLearningCompleteInput,
): Promise<LearningCompletion> {
  const parsedInput = markLearningCompleteInputSchema.parse(input);
  const response = await client.post<unknown>(
    "/learning/completions",
    parsedInput,
  );
  return learningCompletionResponseSchema.parse(response).data;
}
