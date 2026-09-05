import { z } from "zod";

import { ATTENDANCE_WORK_MODES } from "./attendance.types";

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");

export const checkInSchema = z.object({
  workMode: z.enum(ATTENDANCE_WORK_MODES).default("office"),
  remarks: z.string().max(500).optional(),
});

export const checkOutSchema = z.object({
  remarks: z.string().max(500).optional(),
});

export const myAttendanceQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  from: dateString.optional(),
  to: dateString.optional(),
  status: z.string().optional(),
});

export const monthlyReportQuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "Month must be YYYY-MM")
    .optional(),
  employeeId: z.string().uuid().optional(),
  department: z.string().max(100).optional(),
});

export const departmentReportQuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "Month must be YYYY-MM")
    .optional(),
  department: z.string().max(100).optional(),
});

export type CheckInInput = z.infer<typeof checkInSchema>;
export type CheckOutInput = z.infer<typeof checkOutSchema>;
export type MyAttendanceQuery = z.infer<typeof myAttendanceQuerySchema>;
export type MonthlyReportQuery = z.infer<typeof monthlyReportQuerySchema>;
export type DepartmentReportQuery = z.infer<typeof departmentReportQuerySchema>;
