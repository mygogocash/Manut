import type { Db } from "@nexora/db";
import { eq, schema } from "@nexora/db";
import { NotFoundException } from "../../http-exception.js";
import * as attendanceRepo from "./attendance.repository.js";
import * as metaRepo from "./attendance-meta.repository.js";
import type {
  AttendancePolicyDto,
  AttendanceWorkMode,
} from "@nexora/contracts/modules/hrms/attendance.types";
import type { UpdatePolicyInput } from "@nexora/contracts/modules/hrms/attendance-phase2.validation";

function parseWorkModes(value: unknown): AttendanceWorkMode[] {
  if (Array.isArray(value)) {
    return value.filter((m): m is AttendanceWorkMode =>
      ["office", "remote", "hybrid"].includes(m as string),
    );
  }
  return ["office", "remote", "hybrid"];
}

function parseWeekendDays(value: unknown): number[] {
  if (Array.isArray(value)) {
    return value.filter((d): d is number => typeof d === "number");
  }
  return [0, 6];
}

function serializePolicy(row: {
  id: string;
  entityId: string | null;
  shiftStartTime: string;
  shiftEndTime: string;
  graceMinutes: number;
  halfDayThresholdHours: string | number;
  minimumWorkingHours: string | number;
  allowedWorkModes: unknown;
  weekendDays: unknown;
  attendanceThresholdPct: number;
  defaultTimezone?: string;
  missedCheckInAfterMinutes?: number;
  missedCheckOutAfterMinutes?: number;
  consecutiveAbsenceAlertDays?: number;
  isActive: boolean;
}): AttendancePolicyDto {
  const half = Number(row.halfDayThresholdHours);
  const minH = Number(row.minimumWorkingHours);

  return {
    id: row.id,
    entityId: row.entityId,
    shiftStartTime: row.shiftStartTime,
    shiftEndTime: row.shiftEndTime,
    graceMinutes: row.graceMinutes,
    halfDayThresholdHours: half,
    minimumWorkingHours: minH,
    allowedWorkModes: parseWorkModes(row.allowedWorkModes),
    weekendDays: parseWeekendDays(row.weekendDays),
    attendanceThresholdPct: row.attendanceThresholdPct,
    defaultTimezone: row.defaultTimezone ?? "Asia/Bangkok",
    missedCheckInAfterMinutes: row.missedCheckInAfterMinutes ?? 120,
    missedCheckOutAfterMinutes: row.missedCheckOutAfterMinutes ?? 60,
    consecutiveAbsenceAlertDays: row.consecutiveAbsenceAlertDays ?? 3,
    isActive: row.isActive,
  };
}

export async function getPolicy(db: Db, entityId?: string | null) {
    const policy = await attendanceRepo.findPolicyForEntity(db, entityId ?? null);
    if (!policy) throw new NotFoundException("Attendance policy not found");
    return serializePolicy(policy);
}

export async function updatePolicy(db: Db, input: UpdatePolicyInput) {
    const entityId = input.entityId ?? null;
    const existing = await attendanceRepo.findPolicyForEntity(db, entityId);

    const data = {
      ...(input.shiftStartTime !== undefined && {
        shiftStartTime: input.shiftStartTime,
      }),
      ...(input.shiftEndTime !== undefined && {
        shiftEndTime: input.shiftEndTime,
      }),
      ...(input.graceMinutes !== undefined && {
        graceMinutes: input.graceMinutes,
      }),
      ...(input.halfDayThresholdHours !== undefined && {
        halfDayThresholdHours: String(input.halfDayThresholdHours),
      }),
      ...(input.minimumWorkingHours !== undefined && {
        minimumWorkingHours: String(input.minimumWorkingHours),
      }),
      ...(input.allowedWorkModes !== undefined && {
        allowedWorkModes: input.allowedWorkModes,
      }),
      ...(input.weekendDays !== undefined && {
        weekendDays: input.weekendDays,
      }),
      ...(input.attendanceThresholdPct !== undefined && {
        attendanceThresholdPct: input.attendanceThresholdPct,
      }),
      ...(input.defaultTimezone !== undefined && {
        defaultTimezone: input.defaultTimezone,
      }),
      ...(input.missedCheckInAfterMinutes !== undefined && {
        missedCheckInAfterMinutes: input.missedCheckInAfterMinutes,
      }),
      ...(input.missedCheckOutAfterMinutes !== undefined && {
        missedCheckOutAfterMinutes: input.missedCheckOutAfterMinutes,
      }),
      ...(input.consecutiveAbsenceAlertDays !== undefined && {
        consecutiveAbsenceAlertDays: input.consecutiveAbsenceAlertDays,
      }),
    };

    if (existing) {
      const updated = await metaRepo.updatePolicyById(db, existing.id, data);
      if (!updated) throw new NotFoundException("Attendance policy not found");
      return serializePolicy(updated);
    }

    const created = await metaRepo.createPolicy(db, {
      entityId,
      shiftStartTime: input.shiftStartTime ?? "09:00",
      shiftEndTime: input.shiftEndTime ?? "18:00",
      graceMinutes: input.graceMinutes ?? 15,
      halfDayThresholdHours: String(input.halfDayThresholdHours ?? 4),
      minimumWorkingHours: String(input.minimumWorkingHours ?? 8),
      allowedWorkModes: input.allowedWorkModes ?? ["office", "remote", "hybrid"],
      weekendDays: input.weekendDays ?? [0, 6],
      attendanceThresholdPct: input.attendanceThresholdPct ?? 80,
      defaultTimezone: input.defaultTimezone ?? "Asia/Bangkok",
      isActive: true,
    });
    if (!created) throw new NotFoundException("Failed to create policy");
    return serializePolicy(created);
  }
