import { z } from "zod";

import type { ApiClient } from "../api/api-client";
import type { RequestAbortSignal } from "../api/api-types";

const nullableText = z.string().nullable();

export const surveyFormStatusSchema = z.enum(["draft", "published", "closed"]);

const paginationMetaSchema = z
  .object({
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative().optional(),
  })
  .passthrough();

const surveyFormApiSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    description: nullableText.optional(),
    status: surveyFormStatusSchema,
    isAnonymous: z.boolean().optional(),
    publishedAt: nullableText.optional(),
    closedAt: nullableText.optional(),
    alreadyResponded: z.boolean().optional(),
    _count: z
      .object({
        questions: z.number().int().nonnegative(),
        responses: z.number().int().nonnegative().optional(),
      })
      .optional(),
    questions: z
      .array(
        z
          .object({
            id: z.string().min(1),
            order: z.number().int().nonnegative(),
            type: z.string().min(1),
            prompt: z.string().min(1),
            required: z.boolean().optional(),
          })
          .passthrough(),
      )
      .optional(),
  })
  .passthrough();

export const surveyFormSummarySchema = surveyFormApiSchema.transform(
  (row) => ({
    id: row.id,
    title: row.title,
    description: row.description ?? null,
    status: row.status,
    isAnonymous: row.isAnonymous ?? false,
    publishedAt: row.publishedAt ?? null,
    closedAt: row.closedAt ?? null,
    alreadyResponded: row.alreadyResponded ?? false,
    questionCount: row._count?.questions ?? row.questions?.length ?? 0,
  }),
);

export const surveyFormDetailSchema = surveyFormApiSchema.transform((row) => ({
  id: row.id,
  title: row.title,
  description: row.description ?? null,
  status: row.status,
  isAnonymous: row.isAnonymous ?? false,
  publishedAt: row.publishedAt ?? null,
  closedAt: row.closedAt ?? null,
  alreadyResponded: row.alreadyResponded ?? false,
  questionCount: row._count?.questions ?? row.questions?.length ?? 0,
  questions: (row.questions ?? []).map((question) => ({
    id: question.id,
    order: question.order,
    type: question.type,
    prompt: question.prompt,
    required: question.required ?? false,
  })),
}));

const surveyFormListParamsSchema = z
  .object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(100).default(20),
  })
  .strict();

const surveyFormListResponseSchema = z
  .object({
    data: z.array(surveyFormSummarySchema),
    meta: paginationMetaSchema,
  })
  .strict();

const surveyFormDetailResponseSchema = z
  .object({
    data: surveyFormDetailSchema,
  })
  .strict();

export type SurveyFormSummary = z.infer<typeof surveyFormSummarySchema>;
export type SurveyFormDetail = z.infer<typeof surveyFormDetailSchema>;
export type SurveyFormList = z.infer<typeof surveyFormListResponseSchema>;
export type SurveyFormListParams = z.input<typeof surveyFormListParamsSchema>;
export type SurveyFormStatus = z.infer<typeof surveyFormStatusSchema>;

export const SURVEY_FORMS_QUERY_ROOT = ["survey-forms", "list"] as const;
export const SURVEY_FORM_DETAIL_QUERY_ROOT = [
  "survey-forms",
  "detail",
] as const;

export function surveyFormsQueryKey(params: SurveyFormListParams = {}) {
  return [
    ...SURVEY_FORMS_QUERY_ROOT,
    surveyFormListParamsSchema.parse(params),
  ] as const;
}

export function surveyFormDetailQueryKey(id: string) {
  return [...SURVEY_FORM_DETAIL_QUERY_ROOT, id] as const;
}

export async function listSurveyForms(
  client: ApiClient,
  params: SurveyFormListParams = {},
  signal?: RequestAbortSignal,
): Promise<SurveyFormList> {
  const parsed = surveyFormListParamsSchema.parse(params);
  const query = `page=${parsed.page}&limit=${parsed.limit}`;
  const response = await client.get<unknown>(
    `/survey-forms?${query}`,
    signal ? { signal } : undefined,
  );
  return surveyFormListResponseSchema.parse(response);
}

export async function getSurveyForm(
  client: ApiClient,
  id: string,
  signal?: RequestAbortSignal,
): Promise<SurveyFormDetail> {
  const response = await client.get<unknown>(
    `/survey-forms/${encodeURIComponent(id)}`,
    signal ? { signal } : undefined,
  );
  return surveyFormDetailResponseSchema.parse(response).data;
}
