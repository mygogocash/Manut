import { z } from "zod";

import type { ApiClient } from "../api/api-client";
import type { RequestAbortSignal } from "../api/api-types";

const holidayEntitySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  code: z.string().min(1),
});

// Read-only projection for the holidays foundation list.
export const publicHolidaySchema = z
  .object({
    id: z.string().min(1),
    entityId: z.string().min(1),
    date: z.union([z.string().min(1), z.date()]).transform((value) =>
      typeof value === "string" ? value.slice(0, 10) : value.toISOString().slice(0, 10),
    ),
    name: z.string().min(1),
    notes: z.string().nullable(),
    isActive: z.boolean(),
    entity: holidayEntitySchema,
  })
  .transform((holiday) => ({
    id: holiday.id,
    entityId: holiday.entityId,
    date: holiday.date,
    name: holiday.name,
    notes: holiday.notes,
    isActive: holiday.isActive,
    entity: holiday.entity,
  }));

const paginationMetaSchema = z
  .object({
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  })
  .strict();

const holidaysResponseSchema = z
  .object({
    data: z.array(publicHolidaySchema),
    meta: paginationMetaSchema,
  })
  .strict();

export const holidayListParamsSchema = z
  .object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(100).default(50),
    entityId: z.string().uuid().optional(),
    year: z.number().int().positive().optional(),
  })
  .strict();

export type PublicHoliday = z.infer<typeof publicHolidaySchema>;
export type HolidayListParams = z.input<typeof holidayListParamsSchema>;
export type HolidayList = z.infer<typeof holidaysResponseSchema>;

export const HOLIDAYS_QUERY_ROOT = ["holidays"] as const;

export function holidaysQueryKey(params: HolidayListParams) {
  return [...HOLIDAYS_QUERY_ROOT, holidayListParamsSchema.parse(params)] as const;
}

function encodeHolidayQuery(
  params: z.output<typeof holidayListParamsSchema>,
): string {
  const entries: Array<[string, string | number | undefined]> = [
    ["page", params.page],
    ["limit", params.limit],
    ["entityId", params.entityId],
    ["year", params.year],
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

export async function listHolidays(
  client: ApiClient,
  params: HolidayListParams = {},
  signal?: RequestAbortSignal,
): Promise<HolidayList> {
  const query = encodeHolidayQuery(holidayListParamsSchema.parse(params));
  const response = await client.get<unknown>(
    `/holidays?${query}`,
    signal ? { signal } : undefined,
  );
  return holidaysResponseSchema.parse(response);
}
