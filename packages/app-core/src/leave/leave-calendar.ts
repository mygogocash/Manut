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

const leaveCalendarEmployeeSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    department: z.string().nullable().optional(),
  })
  .transform((employee) => ({
    id: employee.id,
    name: employee.name,
    department: employee.department ?? null,
  }));

const leaveCalendarTypeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  code: z.string().min(1),
  category: leaveCategorySchema,
});

// Calendar foundation strips reason and employee email.
export const leaveCalendarEntrySchema = z
  .object({
    id: z.string().min(1),
    startDate: apiCalendarDateSchema,
    endDate: apiCalendarDateSchema,
    status: leaveRequestStatusSchema,
    durationType: leaveDurationTypeSchema.default("full_day"),
    halfDayPeriod: halfDayPeriodSchema.nullable().optional(),
    days: z
      .union([z.string(), z.number().finite()])
      .transform((value) => String(value)),
    employee: leaveCalendarEmployeeSchema,
    leaveType: leaveCalendarTypeSchema,
  })
  .transform((entry) => ({
    id: entry.id,
    startDate: entry.startDate,
    endDate: entry.endDate,
    status: entry.status,
    durationType: entry.durationType,
    halfDayPeriod: entry.halfDayPeriod ?? null,
    days: entry.days,
    employee: entry.employee,
    leaveType: entry.leaveType,
  }));

const leaveCalendarResponseSchema = z
  .object({ data: z.array(leaveCalendarEntrySchema) })
  .strict();

export const leaveCalendarParamsSchema = z
  .object({
    from: leaveDateSchema,
    to: leaveDateSchema,
    department: z.string().trim().min(1).max(100).optional(),
  })
  .strict()
  .refine((value) => value.to >= value.from, {
    message: "End date must not be before start date",
    path: ["to"],
  });

export type LeaveCalendarEntry = z.infer<typeof leaveCalendarEntrySchema>;
export type LeaveCalendarParams = z.input<typeof leaveCalendarParamsSchema>;

export const LEAVE_CALENDAR_QUERY_ROOT = ["leave", "calendar"] as const;

export function leaveCalendarQueryKey(params: LeaveCalendarParams) {
  return [
    ...LEAVE_CALENDAR_QUERY_ROOT,
    leaveCalendarParamsSchema.parse(params),
  ] as const;
}

function encodeCalendarQuery(
  params: z.output<typeof leaveCalendarParamsSchema>,
): string {
  const entries: Array<[string, string | undefined]> = [
    ["from", params.from],
    ["to", params.to],
    ["department", params.department],
  ];
  return entries
    .filter((entry): entry is [string, string] => entry[1] !== undefined)
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
    )
    .join("&");
}

export async function listLeaveCalendar(
  client: ApiClient,
  params: LeaveCalendarParams,
  signal?: RequestAbortSignal,
): Promise<LeaveCalendarEntry[]> {
  const query = encodeCalendarQuery(leaveCalendarParamsSchema.parse(params));
  const response = await client.get<unknown>(
    `/leave/calendar?${query}`,
    signal ? { signal } : undefined,
  );
  return leaveCalendarResponseSchema.parse(response).data;
}
