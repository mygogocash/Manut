import { z } from "zod";

import type { ApiClient } from "../api/api-client";
import type { RequestAbortSignal } from "../api/api-types";

const nullableText = z.string().nullable();

function toCalendarDate(value: string): string {
  return value.slice(0, 10);
}

const apiCalendarDateSchema = z.string().min(10).transform(toCalendarDate);

const paginationMetaSchema = z
  .object({
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  })
  .strict();

// ─── ESOP grants (read projection) ───────────────────────

export const esopGrantTypeSchema = z.enum([
  "equity",
  "tokens",
  "sign_up_bonus",
  "executive_equity",
  "retention",
  "annual_review",
  "performance_bonus",
  "advisory",
  "other",
]);

export const esopValueTypeSchema = z.enum(["shares", "currency", "percent"]);

export const esopGrantStatusSchema = z.enum([
  "vesting",
  "vested",
  "cancelled",
]);

const esopEmployeeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  email: z.string().min(1),
  department: nullableText,
});

// List receipts keep identity + vesting summary and strip notes / import
// source internals that belong to the manage/import slice.
const esopGrantApiSchema = z
  .object({
    id: z.string().min(1),
    employee: esopEmployeeSchema,
    grantDate: apiCalendarDateSchema,
    grantType: esopGrantTypeSchema,
    valueType: esopValueTypeSchema,
    shares: z.number().finite(),
    vestingMonths: z.number().int().nullable().optional(),
    vestedToDate: z.number().finite(),
    status: esopGrantStatusSchema,
    notes: z.unknown().optional(),
    source: z.unknown().optional(),
    exercisedShares: z.unknown().optional(),
  })
  .passthrough();

export const esopGrantSchema = esopGrantApiSchema.transform((grant) => ({
  id: grant.id,
  employee: grant.employee,
  grantDate: grant.grantDate,
  grantType: grant.grantType,
  valueType: grant.valueType,
  shares: grant.shares,
  vestingMonths: grant.vestingMonths ?? null,
  vestedToDate: grant.vestedToDate,
  status: grant.status,
}));

const esopGrantsResponseSchema = z
  .object({
    data: z.array(esopGrantSchema),
    meta: paginationMetaSchema,
  })
  .strict();

export const esopGrantListParamsSchema = z
  .object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(100).default(20),
  })
  .strict();

export type EsopGrantType = z.infer<typeof esopGrantTypeSchema>;
export type EsopValueType = z.infer<typeof esopValueTypeSchema>;
export type EsopGrantStatus = z.infer<typeof esopGrantStatusSchema>;
export type EsopGrant = z.infer<typeof esopGrantSchema>;
export type EsopGrantListParams = z.input<typeof esopGrantListParamsSchema>;
export type EsopGrantList = z.infer<typeof esopGrantsResponseSchema>;

export const ESOP_GRANTS_QUERY_ROOT = ["hrms", "esop-grants"] as const;

export function esopGrantsQueryKey(params: EsopGrantListParams = {}) {
  return [
    ...ESOP_GRANTS_QUERY_ROOT,
    esopGrantListParamsSchema.parse(params),
  ] as const;
}

function encodePageLimit(
  params: z.output<typeof esopGrantListParamsSchema>,
): string {
  return `page=${encodeURIComponent(String(params.page))}&limit=${encodeURIComponent(String(params.limit))}`;
}

export async function listEsopGrants(
  client: ApiClient,
  params: EsopGrantListParams = {},
  signal?: RequestAbortSignal,
): Promise<EsopGrantList> {
  const query = encodePageLimit(esopGrantListParamsSchema.parse(params));
  const response = await client.get<unknown>(
    `/hrms/esop-grants?${query}`,
    signal ? { signal } : undefined,
  );
  return esopGrantsResponseSchema.parse(response);
}

// ─── Onboarding runs (read projection) ───────────────────

const onboardingTaskSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  part: z.string().min(1),
  done: z.boolean(),
});

const onboardingRunApiSchema = z
  .object({
    id: z.string().min(1),
    employeeName: z.string().min(1),
    department: z.string().min(1),
    startDate: apiCalendarDateSchema,
    status: z.string().min(1),
    tasks: z.array(onboardingTaskSchema).default([]),
    entity: z
      .object({
        id: z.string().min(1),
        name: z.string().min(1),
      })
      .nullable()
      .optional(),
  })
  .passthrough();

export const onboardingRunSchema = onboardingRunApiSchema.transform((run) => ({
  id: run.id,
  employeeName: run.employeeName,
  department: run.department,
  startDate: run.startDate,
  status: run.status,
  tasksDone: run.tasks.filter((task) => task.done).length,
  tasksTotal: run.tasks.length,
  entityName: run.entity?.name ?? null,
}));

const onboardingRunsResponseSchema = z
  .object({
    data: z.array(onboardingRunSchema),
    meta: paginationMetaSchema,
  })
  .strict();

export const onboardingRunListParamsSchema = z
  .object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(100).default(20),
  })
  .strict();

export type OnboardingRun = z.infer<typeof onboardingRunSchema>;
export type OnboardingRunListParams = z.input<
  typeof onboardingRunListParamsSchema
>;
export type OnboardingRunList = z.infer<typeof onboardingRunsResponseSchema>;

export const ONBOARDING_RUNS_QUERY_ROOT = ["hrms", "onboarding"] as const;

export function onboardingRunsQueryKey(params: OnboardingRunListParams = {}) {
  return [
    ...ONBOARDING_RUNS_QUERY_ROOT,
    onboardingRunListParamsSchema.parse(params),
  ] as const;
}

export async function listOnboardingRuns(
  client: ApiClient,
  params: OnboardingRunListParams = {},
  signal?: RequestAbortSignal,
): Promise<OnboardingRunList> {
  const query = encodePageLimit(onboardingRunListParamsSchema.parse(params));
  const response = await client.get<unknown>(
    `/hrms/onboarding?${query}`,
    signal ? { signal } : undefined,
  );
  return onboardingRunsResponseSchema.parse(response);
}

// ─── Attendance today + check-in/out ─────────────────────

export const attendanceWorkModeSchema = z.enum(["office", "remote", "hybrid"]);

export const attendanceStatusSchema = z.enum([
  "present",
  "late",
  "absent",
  "on_leave",
  "remote",
  "hybrid",
  "public_holiday",
  "weekend",
  "on_exception",
]);

const attendanceRecordApiSchema = z
  .object({
    id: z.string().min(1),
    attendanceDate: apiCalendarDateSchema,
    status: attendanceStatusSchema,
    workMode: attendanceWorkModeSchema,
    localCheckInTime: nullableText,
    localCheckOutTime: nullableText,
    totalHours: z.number().finite().nullable(),
    lateMinutes: z.number().int().nonnegative(),
  })
  .passthrough();

export const attendanceRecordSchema = attendanceRecordApiSchema.transform(
  (record) => ({
    id: record.id,
    attendanceDate: record.attendanceDate,
    status: record.status,
    workMode: record.workMode,
    localCheckInTime: record.localCheckInTime,
    localCheckOutTime: record.localCheckOutTime,
    totalHours: record.totalHours,
    lateMinutes: record.lateMinutes,
  }),
);

const attendanceTodayResponseSchema = z
  .object({
    data: attendanceRecordSchema.nullable(),
  })
  .strict();

const attendanceMutationResponseSchema = z
  .object({
    data: attendanceRecordSchema,
  })
  .strict();

export const checkInAttendanceInputSchema = z
  .object({
    workMode: attendanceWorkModeSchema.default("office"),
    remarks: z.string().trim().max(500).optional(),
  })
  .strict();

export const checkOutAttendanceInputSchema = z
  .object({
    remarks: z.string().trim().max(500).optional(),
  })
  .strict();

export type AttendanceWorkMode = z.infer<typeof attendanceWorkModeSchema>;
export type AttendanceStatus = z.infer<typeof attendanceStatusSchema>;
export type AttendanceRecord = z.infer<typeof attendanceRecordSchema>;
export type CheckInAttendanceInput = z.input<
  typeof checkInAttendanceInputSchema
>;
export type CheckOutAttendanceInput = z.input<
  typeof checkOutAttendanceInputSchema
>;

export const ATTENDANCE_TODAY_QUERY_KEY = ["hrms", "attendance", "today"] as const;

export async function getAttendanceToday(
  client: ApiClient,
  signal?: RequestAbortSignal,
): Promise<AttendanceRecord | null> {
  const response = await client.get<unknown>(
    "/hrms/attendance/today",
    signal ? { signal } : undefined,
  );
  return attendanceTodayResponseSchema.parse(response).data;
}

export async function checkInAttendance(
  client: ApiClient,
  input: CheckInAttendanceInput = {},
): Promise<AttendanceRecord> {
  const body = checkInAttendanceInputSchema.parse(input);
  const response = await client.post<unknown>("/hrms/attendance/check-in", body);
  return attendanceMutationResponseSchema.parse(response).data;
}

export async function checkOutAttendance(
  client: ApiClient,
  input: CheckOutAttendanceInput = {},
): Promise<AttendanceRecord> {
  const body = checkOutAttendanceInputSchema.parse(input);
  const response = await client.post<unknown>(
    "/hrms/attendance/check-out",
    body,
  );
  return attendanceMutationResponseSchema.parse(response).data;
}
