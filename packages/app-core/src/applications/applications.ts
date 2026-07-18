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

// Recruiter inbox keeps contact fields; resume storage urls become hasResume.
// Status writes / delete stay deferred.
const applicationApiSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    email: z.string().min(1),
    mobile: z.string().min(1),
    linkedin: nullableText.optional(),
    website: nullableText.optional(),
    attachment: z.string().min(1).optional(),
    createdAt: z.string().min(1),
    job: z.object({
      id: z.string().min(1),
      title: z.string().min(1),
      department: z.string().min(1),
      location: z.string().min(1),
    }),
  })
  .passthrough();

export const applicationSchema = applicationApiSchema.transform((app) => ({
  id: app.id,
  name: app.name,
  email: app.email,
  mobile: app.mobile,
  linkedin: app.linkedin ?? null,
  website: app.website ?? null,
  hasResume: Boolean(app.attachment),
  createdAt: app.createdAt,
  job: {
    id: app.job.id,
    title: app.job.title,
    department: app.job.department,
    location: app.job.location,
  },
}));

const applicationsResponseSchema = z
  .object({
    data: z.array(applicationSchema),
    meta: paginationMetaSchema,
  })
  .strict();

export const applicationListParamsSchema = z
  .object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(100).default(20),
    jobId: z.string().uuid().optional(),
    search: z.string().trim().min(1).optional(),
  })
  .strict();

export type Application = z.infer<typeof applicationSchema>;
export type ApplicationListParams = z.input<typeof applicationListParamsSchema>;
export type ApplicationList = z.infer<typeof applicationsResponseSchema>;

export const APPLICATIONS_QUERY_ROOT = ["applications", "list"] as const;

export function applicationsQueryKey(params: ApplicationListParams = {}) {
  return [
    ...APPLICATIONS_QUERY_ROOT,
    applicationListParamsSchema.parse(params),
  ] as const;
}

function encodeApplicationQuery(
  params: z.output<typeof applicationListParamsSchema>,
): string {
  const entries: Array<[string, string | number | undefined]> = [
    ["page", params.page],
    ["limit", params.limit],
    ["jobId", params.jobId],
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

export async function listApplications(
  client: ApiClient,
  params: ApplicationListParams = {},
  signal?: RequestAbortSignal,
): Promise<ApplicationList> {
  const query = encodeApplicationQuery(
    applicationListParamsSchema.parse(params),
  );
  const response = await client.get<unknown>(
    `/applications?${query}`,
    signal ? { signal } : undefined,
  );
  return applicationsResponseSchema.parse(response);
}
