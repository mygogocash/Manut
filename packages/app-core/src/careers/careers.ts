import { z } from "zod";

import type { ApiClient } from "../api/api-client";
import type { RequestAbortSignal } from "../api/api-types";

const paginationMetaSchema = z
  .object({
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  })
  .strict();

// Job list strips slug; apply + manage writes stay deferred.
const careerJobApiSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    slug: z.string().nullable().optional(),
    type: z.string().min(1),
    location: z.string().min(1),
    department: z.string().min(1),
    description: z.string().min(1),
    active: z.boolean(),
    createdAt: z.string().min(1),
    updatedAt: z.string().min(1).optional(),
    _count: z
      .object({
        applications: z.number().int().nonnegative(),
      })
      .optional(),
  })
  .passthrough();

export const careerJobSchema = careerJobApiSchema.transform((job) => ({
  id: job.id,
  title: job.title,
  type: job.type,
  location: job.location,
  department: job.department,
  description: job.description,
  active: job.active,
  applicationCount: job._count?.applications ?? 0,
  createdAt: job.createdAt,
}));

const careerJobsResponseSchema = z
  .object({
    data: z.array(careerJobSchema),
    meta: paginationMetaSchema,
  })
  .strict();

export const careerJobListParamsSchema = z
  .object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(100).default(20),
    department: z.string().trim().min(1).optional(),
    type: z.string().trim().min(1).optional(),
    active: z.boolean().optional(),
    search: z.string().trim().min(1).optional(),
  })
  .strict();

export type CareerJob = z.infer<typeof careerJobSchema>;
export type CareerJobListParams = z.input<typeof careerJobListParamsSchema>;
export type CareerJobList = z.infer<typeof careerJobsResponseSchema>;

export const CAREER_JOBS_QUERY_ROOT = ["career", "jobs"] as const;

export function careerJobsQueryKey(params: CareerJobListParams = {}) {
  return [
    ...CAREER_JOBS_QUERY_ROOT,
    careerJobListParamsSchema.parse(params),
  ] as const;
}

function encodeCareerQuery(
  params: z.output<typeof careerJobListParamsSchema>,
): string {
  const entries: Array<[string, string | number | boolean | undefined]> = [
    ["page", params.page],
    ["limit", params.limit],
    ["department", params.department],
    ["type", params.type],
    ["active", params.active],
    ["search", params.search],
  ];
  return entries
    .filter(
      (entry): entry is [string, string | number | boolean] =>
        entry[1] !== undefined,
    )
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`,
    )
    .join("&");
}

export async function listCareerJobs(
  client: ApiClient,
  params: CareerJobListParams = {},
  signal?: RequestAbortSignal,
): Promise<CareerJobList> {
  const query = encodeCareerQuery(careerJobListParamsSchema.parse(params));
  const response = await client.get<unknown>(
    `/career?${query}`,
    signal ? { signal } : undefined,
  );
  return careerJobsResponseSchema.parse(response);
}
