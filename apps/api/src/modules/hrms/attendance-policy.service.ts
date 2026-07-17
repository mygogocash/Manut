import { NotFoundException } from "@/common/exceptions/http-exception";
import { prisma } from "@/infrastructure/database/prisma";
import { attendanceRepository } from "@/modules/hrms/attendance.repository";
import type {
  AttendancePolicyDto,
  AttendanceWorkMode,
} from "@/modules/hrms/attendance.types";
import type { UpdatePolicyInput } from "@/modules/hrms/attendance-phase2.validation";

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
  halfDayThresholdHours: { toNumber?: () => number } | number;
  minimumWorkingHours: { toNumber?: () => number } | number;
  allowedWorkModes: unknown;
  weekendDays: unknown;
  attendanceThresholdPct: number;
  defaultTimezone?: string;
  missedCheckInAfterMinutes?: number;
  missedCheckOutAfterMinutes?: number;
  consecutiveAbsenceAlertDays?: number;
  isActive: boolean;
}): AttendancePolicyDto {
  const half =
    typeof row.halfDayThresholdHours === "object" &&
    row.halfDayThresholdHours !== null &&
    "toNumber" in row.halfDayThresholdHours
      ? row.halfDayThresholdHours.toNumber!()
      : Number(row.halfDayThresholdHours);
  const minH =
    typeof row.minimumWorkingHours === "object" &&
    row.minimumWorkingHours !== null &&
    "toNumber" in row.minimumWorkingHours
      ? row.minimumWorkingHours.toNumber!()
      : Number(row.minimumWorkingHours);

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

export const attendancePolicyService = {
  async get(entityId?: string | null) {
    const policy = await attendanceRepository.findPolicyForEntity(
      entityId ?? null,
    );
    if (!policy) throw new NotFoundException("Attendance policy not found");
    return serializePolicy(policy);
  },

  async update(input: UpdatePolicyInput) {
    const entityId = input.entityId ?? null;
    const existing = await attendanceRepository.findPolicyForEntity(entityId);

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
        halfDayThresholdHours: input.halfDayThresholdHours,
      }),
      ...(input.minimumWorkingHours !== undefined && {
        minimumWorkingHours: input.minimumWorkingHours,
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
      const updated = await prisma.attendancePolicy.update({
        where: { id: existing.id },
        data,
      });
      return serializePolicy(updated);
    }

    const created = await prisma.attendancePolicy.create({
      data: {
        entityId,
        shiftStartTime: input.shiftStartTime ?? "09:00",
        shiftEndTime: input.shiftEndTime ?? "18:00",
        graceMinutes: input.graceMinutes ?? 15,
        halfDayThresholdHours: input.halfDayThresholdHours ?? 4,
        minimumWorkingHours: input.minimumWorkingHours ?? 8,
        allowedWorkModes: input.allowedWorkModes ?? [
          "office",
          "remote",
          "hybrid",
        ],
        weekendDays: input.weekendDays ?? [0, 6],
        attendanceThresholdPct: input.attendanceThresholdPct ?? 80,
        isActive: true,
      },
    });
    return serializePolicy(created);
  },
};
