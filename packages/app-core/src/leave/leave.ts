import { z } from "zod";

import type { ApiClient } from "../api/api-client";
import type { RequestAbortSignal } from "../api/api-types";

const nullableText = z.string().nullable();
const finiteNumber = z.number().finite();

export const leaveCategorySchema = z.enum([
  "sick",
  "casual",
  "earned",
  "paid",
  "unpaid",
  "other",
]);

export const leaveEntitySchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    code: z.string().min(1),
  })
  .strict();

export const leaveTypeSchema = z
  .object({
    id: z.string().min(1),
    entityId: nullableText,
    entity: leaveEntitySchema.nullable(),
    name: z.string().min(1),
    code: z.string().min(1),
    description: nullableText,
    category: leaveCategorySchema,
    daysPerYear: z.number().int().nonnegative(),
    requiresApproval: z.boolean(),
    isPaid: z.boolean(),
    isActive: z.boolean(),
  })
  .strict();

export const leaveTypeRefSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    code: z.string().min(1),
    category: leaveCategorySchema,
  })
  .strict();

// List endpoints attach policy metadata we do not surface; strip extras.
const leaveRequestTypeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  code: z.string().min(1),
  category: leaveCategorySchema,
});

function isCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export const leaveDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD format")
  .refine(isCalendarDate, "Enter a valid calendar date");

export const leaveBalanceSchema = z
  .object({
    id: z.string().min(1),
    leaveType: leaveTypeRefSchema,
    year: z.number().int().positive(),
    entitled: finiteNumber,
    used: finiteNumber,
    carried: finiteNumber,
    carriedUsed: finiteNumber,
    carriedExpiry: leaveDateSchema.nullable(),
    carriedExpired: z.boolean(),
    carriedRemaining: finiteNumber,
    adjustment: finiteNumber,
    remaining: finiteNumber,
    synthesized: z.boolean().optional(),
  })
  .strict();

export const leaveDurationTypeSchema = z.enum(["full_day", "half_day"]);
export const halfDayPeriodSchema = z.enum(["am", "pm"]);
export const leaveSourceSchema = z.enum(["entitled", "carried"]);

const optionalReason = z
  .string()
  .trim()
  .max(1000)
  .transform((value) => value || undefined)
  .optional();

export const createLeaveRequestInputSchema = z
  .object({
    leaveTypeId: z.string().min(1, "Select a leave type"),
    startDate: leaveDateSchema,
    endDate: leaveDateSchema,
    durationType: leaveDurationTypeSchema.default("full_day"),
    halfDayPeriod: halfDayPeriodSchema.optional(),
    reason: optionalReason,
    source: leaveSourceSchema.default("entitled"),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.endDate < value.startDate) {
      context.addIssue({
        code: "custom",
        message: "End date must not be before start date",
        path: ["endDate"],
      });
    }
    if (value.durationType === "half_day") {
      if (value.endDate !== value.startDate) {
        context.addIssue({
          code: "custom",
          message: "Half-day leave must use one date",
          path: ["endDate"],
        });
      }
      if (!value.halfDayPeriod) {
        context.addIssue({
          code: "custom",
          message: "Select A.M. or P.M.",
          path: ["halfDayPeriod"],
        });
      }
    } else if (value.halfDayPeriod) {
      context.addIssue({
        code: "custom",
        message: "Half-day period only applies to half-day leave",
        path: ["halfDayPeriod"],
      });
    }
  });

const leaveTypesResponseSchema = z
  .object({ data: z.array(leaveTypeSchema) })
  .strict();
const leaveBalancesResponseSchema = z
  .object({ data: z.array(leaveBalanceSchema) })
  .strict();

export const leaveRequestStatusSchema = z.enum([
  "pending",
  "approved",
  "rejected",
  "cancelled",
  "pending_cancellation",
]);

function toCalendarDate(value: string): string {
  return value.slice(0, 10);
}

const apiCalendarDateSchema = z
  .string()
  .min(10)
  .transform(toCalendarDate)
  .pipe(leaveDateSchema);

// The transitional Express endpoint returns a richer request record. The
// universal client retains only the non-sensitive receipt needed by the UI.
const createdLeaveRequestSchema = z.object({
  id: z.string().min(1),
  status: leaveRequestStatusSchema,
});
const createdLeaveRequestResponseSchema = z
  .object({ data: createdLeaveRequestSchema })
  .strict();

export const leaveRequestSchema = z.object({
  id: z.string().min(1),
  leaveType: leaveRequestTypeSchema,
  startDate: apiCalendarDateSchema,
  endDate: apiCalendarDateSchema,
  durationType: leaveDurationTypeSchema.default("full_day"),
  halfDayPeriod: halfDayPeriodSchema.nullable().optional(),
  days: z
    .union([z.string(), z.number().finite()])
    .transform((value) => String(value)),
  reason: nullableText,
  status: leaveRequestStatusSchema,
  createdAt: z.string().min(1),
});

const paginationMetaSchema = z
  .object({
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  })
  .strict();

const leaveRequestsResponseSchema = z
  .object({
    data: z.array(leaveRequestSchema),
    meta: paginationMetaSchema,
  })
  .strict();

const trimmedOptional = z
  .string()
  .trim()
  .transform((value) => value || undefined)
  .optional();

export const leaveRequestListParamsSchema = z
  .object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(100).default(20),
    employeeId: z.string().uuid(),
    status: leaveRequestStatusSchema.optional(),
    search: trimmedOptional,
  })
  .strict();

export type LeaveCategory = z.infer<typeof leaveCategorySchema>;
export type LeaveType = z.infer<typeof leaveTypeSchema>;
export type LeaveBalance = z.infer<typeof leaveBalanceSchema>;
export type LeaveDurationType = z.infer<typeof leaveDurationTypeSchema>;
export type HalfDayPeriod = z.infer<typeof halfDayPeriodSchema>;
export type LeaveSource = z.infer<typeof leaveSourceSchema>;
export type CreateLeaveRequestInput = z.input<
  typeof createLeaveRequestInputSchema
>;
export type CreatedLeaveRequest = z.infer<typeof createdLeaveRequestSchema>;
export type LeaveRequest = z.infer<typeof leaveRequestSchema>;
export type LeaveRequestListParams = z.input<
  typeof leaveRequestListParamsSchema
>;
export type LeaveRequestList = z.infer<typeof leaveRequestsResponseSchema>;

export const LEAVE_TYPES_QUERY_KEY = ["leave", "types"] as const;
export const LEAVE_BALANCES_QUERY_KEY = ["leave", "balances", "self"] as const;
export const LEAVE_REQUESTS_QUERY_ROOT = ["leave", "requests", "self"] as const;

export function leaveRequestsQueryKey(params: LeaveRequestListParams) {
  return [
    ...LEAVE_REQUESTS_QUERY_ROOT,
    leaveRequestListParamsSchema.parse(params),
  ] as const;
}

function encodeLeaveRequestQuery(
  params: z.output<typeof leaveRequestListParamsSchema>,
): string {
  const entries: Array<[string, string | number | undefined]> = [
    ["page", params.page],
    ["limit", params.limit],
    ["employeeId", params.employeeId],
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

export async function getLeaveTypes(
  client: ApiClient,
  signal?: RequestAbortSignal,
): Promise<LeaveType[]> {
  const response = await client.get<unknown>(
    "/leave/types",
    signal ? { signal } : undefined,
  );
  return leaveTypesResponseSchema.parse(response).data;
}

export async function getLeaveBalances(
  client: ApiClient,
  signal?: RequestAbortSignal,
): Promise<LeaveBalance[]> {
  const response = await client.get<unknown>(
    "/leave/balances",
    signal ? { signal } : undefined,
  );
  return leaveBalancesResponseSchema.parse(response).data;
}

export async function createLeaveRequest(
  client: ApiClient,
  input: CreateLeaveRequestInput,
): Promise<CreatedLeaveRequest> {
  const parsedInput = createLeaveRequestInputSchema.parse(input);
  const response = await client.post<unknown>("/leave/requests", parsedInput);
  return createdLeaveRequestResponseSchema.parse(response).data;
}

export async function getLeaveRequests(
  client: ApiClient,
  params: LeaveRequestListParams,
  signal?: RequestAbortSignal,
): Promise<LeaveRequestList> {
  const query = encodeLeaveRequestQuery(
    leaveRequestListParamsSchema.parse(params),
  );
  const response = await client.get<unknown>(
    `/leave/requests?${query}`,
    signal ? { signal } : undefined,
  );
  return leaveRequestsResponseSchema.parse(response);
}

export async function cancelLeaveRequest(
  client: ApiClient,
  requestId: string,
): Promise<CreatedLeaveRequest> {
  const id = z.string().min(1).parse(requestId);
  const response = await client.put<unknown>(
    `/leave/requests/${encodeURIComponent(id)}/cancel`,
  );
  return createdLeaveRequestResponseSchema.parse(response).data;
}

export function canCancelLeaveRequest(
  status: z.infer<typeof leaveRequestStatusSchema>,
): boolean {
  return status === "pending" || status === "approved";
}
