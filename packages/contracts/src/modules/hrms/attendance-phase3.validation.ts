import { z } from "zod";

import { SUPPORTED_EMPLOYEE_TIMEZONES } from "./attendance-timezone.util";

export const calendarQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  scope: z.enum(["employee", "team", "department"]).default("employee"),
  department: z.string().optional(),
  employeeId: z.string().uuid().optional(),
});

export const executiveAnalyticsQuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
  department: z.string().optional(),
});

export const employeeProfileQuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
});

export const bulkAssignShiftSchema = z.object({
  employeeIds: z.array(z.string().uuid()).min(1).max(200),
  shiftId: z.string().uuid(),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  effectiveTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export const changeShiftAssignmentSchema = z.object({
  shiftId: z.string().uuid().optional(),
  effectiveFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  effectiveTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
});

export const shiftAssignmentsQuerySchema = z.object({
  entityId: z.string().optional(),
});

export const employeeTimezoneSchema = z.object({
  timezone: z.enum(SUPPORTED_EMPLOYEE_TIMEZONES),
});

export type CalendarQuery = z.output<typeof calendarQuerySchema>;
export type ExecutiveAnalyticsQuery = z.output<
  typeof executiveAnalyticsQuerySchema
>;
export type EmployeeProfileQuery = z.output<typeof employeeProfileQuerySchema>;
export type BulkAssignShiftInput = z.output<typeof bulkAssignShiftSchema>;
export type ChangeShiftAssignmentInput = z.output<
  typeof changeShiftAssignmentSchema
>;
