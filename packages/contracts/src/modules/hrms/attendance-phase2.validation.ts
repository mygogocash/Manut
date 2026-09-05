import { z } from "zod";

import {
  ATTENDANCE_CORRECTION_TYPES,
  ATTENDANCE_EXCEPTION_TYPES,
  ATTENDANCE_WORK_MODES,
} from "./attendance.types";
import { SUPPORTED_EMPLOYEE_TIMEZONES } from "./attendance-timezone.util";

export const createCorrectionSchema = z.object({
  attendanceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  attendanceRecordId: z.string().uuid().optional(),
  correctionType: z.enum(ATTENDANCE_CORRECTION_TYPES),
  reason: z.string().min(1).max(500),
  comments: z.string().max(2000).optional(),
  proposedCheckIn: z.string().datetime().optional(),
  proposedCheckOut: z.string().datetime().optional(),
  proposedWorkMode: z.enum(ATTENDANCE_WORK_MODES).optional(),
});

export const correctionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["pending", "approved", "rejected"]).optional(),
  employeeId: z.string().uuid().optional(),
  scope: z.enum(["mine", "team", "all"]).default("mine"),
});

export const rejectCorrectionSchema = z.object({
  remarks: z.string().min(1).max(1000),
});

export const updatePolicySchema = z.object({
  entityId: z.string().nullable().optional(),
  shiftStartTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  shiftEndTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  graceMinutes: z.number().int().min(0).max(120).optional(),
  halfDayThresholdHours: z.number().min(0).max(24).optional(),
  minimumWorkingHours: z.number().min(0).max(24).optional(),
  allowedWorkModes: z.array(z.enum(ATTENDANCE_WORK_MODES)).min(1).optional(),
  weekendDays: z.array(z.number().int().min(0).max(6)).min(1).optional(),
  attendanceThresholdPct: z.number().int().min(0).max(100).optional(),
  defaultTimezone: z.enum(SUPPORTED_EMPLOYEE_TIMEZONES).optional(),
  missedCheckInAfterMinutes: z.number().int().min(30).max(480).optional(),
  missedCheckOutAfterMinutes: z.number().int().min(30).max(480).optional(),
  consecutiveAbsenceAlertDays: z.number().int().min(2).max(14).optional(),
});

export const policyQuerySchema = z.object({
  entityId: z.string().optional(),
});

export const exportQuerySchema = z.object({
  format: z.enum(["csv", "xlsx"]).default("csv"),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
  department: z.string().optional(),
});

export const createShiftSchema = z.object({
  entityId: z.string().nullable().optional(),
  shiftName: z.string().min(1).max(80),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  graceMinutes: z.number().int().min(0).max(120).default(15),
  active: z.boolean().default(true),
});

export const updateShiftSchema = createShiftSchema.partial();

export const assignShiftSchema = z.object({
  employeeId: z.string().uuid(),
  shiftId: z.string().uuid(),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  effectiveTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export const createExceptionSchema = z.object({
  employeeId: z.string().uuid().optional(),
  type: z.enum(ATTENDANCE_EXCEPTION_TYPES),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().min(1).max(500),
});

export const exceptionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  employeeId: z.string().uuid().optional(),
});

export const analyticsQuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
  department: z.string().optional(),
});

export type CreateCorrectionInput = z.infer<typeof createCorrectionSchema>;
export type CorrectionsQuery = z.infer<typeof correctionsQuerySchema>;
export type UpdatePolicyInput = z.infer<typeof updatePolicySchema>;
export type ExportQuery = z.infer<typeof exportQuerySchema>;
export type CreateShiftInput = z.infer<typeof createShiftSchema>;
export type UpdateShiftInput = z.infer<typeof updateShiftSchema>;
export type AssignShiftInput = z.infer<typeof assignShiftSchema>;
export type CreateExceptionInput = z.infer<typeof createExceptionSchema>;
export type ExceptionsQuery = z.infer<typeof exceptionsQuerySchema>;
export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;
