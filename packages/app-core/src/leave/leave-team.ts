import { z } from "zod";

import type { ApiClient } from "../api/api-client";
import type { RequestAbortSignal } from "../api/api-types";
import {
  halfDayPeriodSchema,
  leaveCategorySchema,
  leaveDateSchema,
  leaveDurationTypeSchema,
  leaveRequestStatusSchema,
} from "./leave";

function toCalendarDate(value: string): string {
  return value.slice(0, 10);
}

const apiCalendarDateSchema = z
  .string()
  .min(10)
  .transform(toCalendarDate)
  .pipe(leaveDateSchema);

const leaveTeamTypeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  code: z.string().min(1),
  category: leaveCategorySchema,
});

const leaveTeamEmployeeSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
  })
  .transform((employee) => ({
    id: employee.id,
    name: employee.name,
  }));

// Team inbox projection keeps employee name; strips email/reportingTo.
export const leaveTeamRequestSchema = z.object({
  id: z.string().min(1),
  leaveType: leaveTeamTypeSchema,
  startDate: apiCalendarDateSchema,
  endDate: apiCalendarDateSchema,
  durationType: leaveDurationTypeSchema.default("full_day"),
  halfDayPeriod: halfDayPeriodSchema.nullable().optional(),
  days: z
    .union([z.string(), z.number().finite()])
    .transform((value) => String(value)),
  reason: z.string().nullable(),
  status: leaveRequestStatusSchema,
  createdAt: z.string().min(1),
  employee: leaveTeamEmployeeSchema,
});

const paginationMetaSchema = z
  .object({
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  })
  .strict();

const leaveTeamRequestsResponseSchema = z
  .object({
    data: z.array(leaveTeamRequestSchema),
    meta: paginationMetaSchema,
  })
  .strict();

const trimmedOptional = z
  .string()
  .trim()
  .transform((value) => value || undefined)
  .optional();

export const leaveTeamRequestListParamsSchema = z
  .object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(100).default(20),
    status: leaveRequestStatusSchema.optional(),
    search: trimmedOptional,
  })
  .strict();

const actedLeaveRequestSchema = z.object({
  id: z.string().min(1),
  status: leaveRequestStatusSchema,
});
const actedLeaveRequestResponseSchema = z
  .object({ data: actedLeaveRequestSchema })
  .strict();

export const rejectLeaveRequestInputSchema = z
  .object({
    reason: z.string().trim().min(1, "Reason is required").max(1000),
  })
  .strict();

export type LeaveTeamRequest = z.infer<typeof leaveTeamRequestSchema>;
export type LeaveTeamRequestList = z.infer<
  typeof leaveTeamRequestsResponseSchema
>;
export type LeaveTeamRequestListParams = z.input<
  typeof leaveTeamRequestListParamsSchema
>;
export type RejectLeaveRequestInput = z.input<
  typeof rejectLeaveRequestInputSchema
>;
export type ActedLeaveRequest = z.infer<typeof actedLeaveRequestSchema>;

export const LEAVE_TEAM_REQUESTS_QUERY_ROOT = [
  "leave",
  "requests",
  "team",
] as const;

export function leaveTeamRequestsQueryKey(params: LeaveTeamRequestListParams) {
  return [
    ...LEAVE_TEAM_REQUESTS_QUERY_ROOT,
    leaveTeamRequestListParamsSchema.parse(params),
  ] as const;
}

function encodeTeamRequestQuery(
  params: z.output<typeof leaveTeamRequestListParamsSchema>,
): string {
  const entries: Array<[string, string | number | undefined]> = [
    ["page", params.page],
    ["limit", params.limit],
    ["status", params.status],
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

export async function listLeaveTeamRequests(
  client: ApiClient,
  params: LeaveTeamRequestListParams,
  signal?: RequestAbortSignal,
): Promise<LeaveTeamRequestList> {
  const query = encodeTeamRequestQuery(
    leaveTeamRequestListParamsSchema.parse(params),
  );
  const response = await client.get<unknown>(
    `/leave/requests?${query}`,
    signal ? { signal } : undefined,
  );
  return leaveTeamRequestsResponseSchema.parse(response);
}

export function canActOnLeaveRequest(
  status: z.infer<typeof leaveRequestStatusSchema>,
): boolean {
  return status === "pending";
}

export async function approveLeaveRequest(
  client: ApiClient,
  requestId: string,
): Promise<ActedLeaveRequest> {
  const id = z.string().min(1).parse(requestId);
  const response = await client.put<unknown>(
    `/leave/requests/${encodeURIComponent(id)}/approve`,
  );
  return actedLeaveRequestResponseSchema.parse(response).data;
}

export async function rejectLeaveRequest(
  client: ApiClient,
  requestId: string,
  input: RejectLeaveRequestInput,
): Promise<ActedLeaveRequest> {
  const id = z.string().min(1).parse(requestId);
  const parsed = rejectLeaveRequestInputSchema.parse(input);
  const response = await client.put<unknown>(
    `/leave/requests/${encodeURIComponent(id)}/reject`,
    parsed,
  );
  return actedLeaveRequestResponseSchema.parse(response).data;
}
