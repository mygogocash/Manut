import { z } from "zod";

import type { ApiClient } from "../api/api-client";
import type { RequestAbortSignal } from "../api/api-types";

const nullableText = z.string().nullable();

export const surveyStatusSchema = z.enum(["draft", "published", "closed"]);

const paginationMetaSchema = z
  .object({
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative().optional(),
  })
  .passthrough();

// List/detail foundation strips target user ids, creator email, and answers.
const surveyApiSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    description: nullableText.optional(),
    status: surveyStatusSchema,
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

export const surveySummarySchema = surveyApiSchema.transform((row) => ({
  id: row.id,
  title: row.title,
  description: row.description ?? null,
  status: row.status,
  isAnonymous: row.isAnonymous ?? false,
  publishedAt: row.publishedAt ?? null,
  closedAt: row.closedAt ?? null,
  alreadyResponded: row.alreadyResponded ?? false,
  questionCount: row._count?.questions ?? row.questions?.length ?? 0,
}));

export const surveyDetailSchema = surveyApiSchema.transform((row) => ({
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

const surveyListParamsSchema = z
  .object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(100).default(20),
  })
  .strict();

const surveyListResponseSchema = z
  .object({
    data: z.array(surveySummarySchema),
    meta: paginationMetaSchema,
  })
  .strict();

const surveyDetailResponseSchema = z
  .object({
    data: surveyDetailSchema,
  })
  .strict();

const myResponseApiSchema = z.union([
  z
    .object({
      id: z.string().min(1),
      answers: z.array(z.unknown()).optional(),
    })
    .passthrough(),
  z.null(),
]);

const myResponseEnvelopeSchema = z
  .object({
    data: myResponseApiSchema,
  })
  .strict();

export type SurveySummary = z.infer<typeof surveySummarySchema>;
export type SurveyDetail = z.infer<typeof surveyDetailSchema>;
export type SurveyList = z.infer<typeof surveyListResponseSchema>;
export type SurveyListParams = z.input<typeof surveyListParamsSchema>;
export type SurveyStatus = z.infer<typeof surveyStatusSchema>;
export type MySurveyResponse = { id: string; answerCount: number } | null;

export const SURVEYS_QUERY_ROOT = ["survey", "list"] as const;
export const SURVEY_DETAIL_QUERY_ROOT = ["survey", "detail"] as const;
export const SURVEY_MY_RESPONSE_QUERY_ROOT = [
  "survey",
  "my-response",
] as const;

export function surveysQueryKey(params: SurveyListParams = {}) {
  return [...SURVEYS_QUERY_ROOT, surveyListParamsSchema.parse(params)] as const;
}

export function surveyDetailQueryKey(id: string) {
  return [...SURVEY_DETAIL_QUERY_ROOT, id] as const;
}

export function surveyMyResponseQueryKey(id: string) {
  return [...SURVEY_MY_RESPONSE_QUERY_ROOT, id] as const;
}

export async function listSurveys(
  client: ApiClient,
  params: SurveyListParams = {},
  signal?: RequestAbortSignal,
): Promise<SurveyList> {
  const parsed = surveyListParamsSchema.parse(params);
  const query = `page=${parsed.page}&limit=${parsed.limit}`;
  const response = await client.get<unknown>(
    `/survey?${query}`,
    signal ? { signal } : undefined,
  );
  return surveyListResponseSchema.parse(response);
}

export async function getSurvey(
  client: ApiClient,
  id: string,
  signal?: RequestAbortSignal,
): Promise<SurveyDetail> {
  const response = await client.get<unknown>(
    `/survey/${encodeURIComponent(id)}`,
    signal ? { signal } : undefined,
  );
  return surveyDetailResponseSchema.parse(response).data;
}

export async function getMySurveyResponse(
  client: ApiClient,
  id: string,
  signal?: RequestAbortSignal,
): Promise<MySurveyResponse> {
  const response = await client.get<unknown>(
    `/survey/${encodeURIComponent(id)}/my-response`,
    signal ? { signal } : undefined,
  );
  const data = myResponseEnvelopeSchema.parse(response).data;
  if (!data) return null;
  return {
    id: data.id,
    answerCount: Array.isArray(data.answers) ? data.answers.length : 0,
  };
}
