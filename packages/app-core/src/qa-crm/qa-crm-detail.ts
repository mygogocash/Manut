import { z } from "zod";

import type { ApiClient } from "../api/api-client";
import type { RequestAbortSignal } from "../api/api-types";

const nullableText = z.string().nullable();
const nullableDateText = z.union([z.string().min(1), z.null()]);

// Detail foundation keeps identity/status/owner/dates; strips description,
// comment/notes, owner email, board, tasks, and members.
const qaCrmProjectDetailApiSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    slug: z.string().min(1),
    status: z.string().min(1),
    department: nullableText.optional(),
    sortOrder: z.number().int().optional(),
    startDate: nullableDateText.optional(),
    endDate: nullableDateText.optional(),
    role: z.string().min(1).optional(),
    owner: z
      .object({
        id: z.string().min(1),
        name: z.string().min(1),
      })
      .passthrough(),
  })
  .passthrough();

export const qaCrmProjectDetailSchema = qaCrmProjectDetailApiSchema.transform(
  (project) => ({
    id: project.id,
    name: project.name,
    slug: project.slug,
    status: project.status,
    department: project.department ?? null,
    sortOrder: project.sortOrder ?? 0,
    startDate: project.startDate ?? null,
    endDate: project.endDate ?? null,
    role: project.role ?? null,
    owner: { id: project.owner.id, name: project.owner.name },
  }),
);

const qaCrmProjectDetailResponseSchema = z
  .object({
    data: qaCrmProjectDetailSchema,
  })
  .strict();

export type QaCrmProjectDetail = z.infer<typeof qaCrmProjectDetailSchema>;

export const QA_CRM_DETAIL_QUERY_ROOT = ["qa-crm", "detail"] as const;

export function qaCrmProjectDetailQueryKey(projectId: string) {
  return [...QA_CRM_DETAIL_QUERY_ROOT, projectId] as const;
}

export async function getQaCrmProject(
  client: ApiClient,
  projectId: string,
  signal?: RequestAbortSignal,
): Promise<QaCrmProjectDetail> {
  const response = await client.get<unknown>(
    `/qa-crm/${encodeURIComponent(projectId)}`,
    signal ? { signal } : undefined,
  );
  return qaCrmProjectDetailResponseSchema.parse(response).data;
}
