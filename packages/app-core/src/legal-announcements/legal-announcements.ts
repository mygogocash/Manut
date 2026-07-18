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

export const announcementKindSchema = z.enum([
  "policy",
  "authorized-persons",
  "handbook",
  "compliance",
  "other",
]);

export const announcementStatusSchema = z.enum([
  "draft",
  "published",
  "archived",
]);

// List foundation strips body, attachments, acks, and author PII.
const announcementApiSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    kind: announcementKindSchema,
    status: announcementStatusSchema,
    pinned: z.boolean(),
    requiresAck: z.boolean().optional(),
  })
  .passthrough();

export const legalAnnouncementSchema = announcementApiSchema.transform(
  (row) => ({
    id: row.id,
    title: row.title,
    kind: row.kind,
    status: row.status,
    pinned: row.pinned,
    requiresAck: row.requiresAck ?? false,
  }),
);

const announcementsResponseSchema = z
  .object({
    data: z.array(legalAnnouncementSchema),
    meta: paginationMetaSchema,
  })
  .strict();

export const legalAnnouncementListParamsSchema = z
  .object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(100).default(20),
    status: announcementStatusSchema.optional(),
    kind: announcementKindSchema.optional(),
    search: z.string().trim().min(1).optional(),
  })
  .strict();

export type LegalAnnouncement = z.infer<typeof legalAnnouncementSchema>;
export type LegalAnnouncementListParams = z.input<
  typeof legalAnnouncementListParamsSchema
>;
export type LegalAnnouncementList = z.infer<
  typeof announcementsResponseSchema
>;
export type AnnouncementKind = z.infer<typeof announcementKindSchema>;
export type AnnouncementStatus = z.infer<typeof announcementStatusSchema>;

export const LEGAL_ANNOUNCEMENTS_QUERY_ROOT = [
  "legal-announcements",
  "list",
] as const;

export function legalAnnouncementsQueryKey(
  params: LegalAnnouncementListParams = {},
) {
  return [
    ...LEGAL_ANNOUNCEMENTS_QUERY_ROOT,
    legalAnnouncementListParamsSchema.parse(params),
  ] as const;
}

function encodeAnnouncementQuery(
  params: z.output<typeof legalAnnouncementListParamsSchema>,
): string {
  const entries: Array<[string, string | number | undefined]> = [
    ["page", params.page],
    ["limit", params.limit],
    ["status", params.status],
    ["kind", params.kind],
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

export async function listLegalAnnouncements(
  client: ApiClient,
  params: LegalAnnouncementListParams = {},
  signal?: RequestAbortSignal,
): Promise<LegalAnnouncementList> {
  const query = encodeAnnouncementQuery(
    legalAnnouncementListParamsSchema.parse(params),
  );
  const response = await client.get<unknown>(
    `/legal-announcements?${query}`,
    signal ? { signal } : undefined,
  );
  return announcementsResponseSchema.parse(response);
}
