import { PERMISSIONS } from "@/common/constants/permissions";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@/common/exceptions/http-exception";
import { prisma } from "@/infrastructure/database/prisma";
import { attendanceRepository } from "@/modules/hrms/attendance.repository";
import type {
  AttendanceCorrectionDto,
  AttendanceCorrectionStatus,
  AttendanceWorkMode,
} from "@/modules/hrms/attendance.types";
import { attendanceCorrectionRepository } from "@/modules/hrms/attendance-correction.repository";
import { attendanceNotificationService } from "@/modules/hrms/attendance-notification.service";
import type {
  CorrectionsQuery,
  CreateCorrectionInput,
} from "@/modules/hrms/attendance-phase2.validation";
import { leaveRepository } from "@/modules/leave/leave.repository";

function toDateOnly(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000Z`);
}

function serializeCorrection(row: {
  id: string;
  employeeId: string;
  attendanceRecordId: string | null;
  attendanceDate: Date;
  correctionType: string;
  reason: string;
  comments: string | null;
  status: string;
  proposedCheckIn: Date | null;
  proposedCheckOut: Date | null;
  proposedWorkMode: string | null;
  approvedBy: string | null;
  approvedAt: Date | null;
  rejectRemarks: string | null;
  createdAt: Date;
  updatedAt: Date;
  employee?: {
    id: string;
    name: string;
    email: string;
    department: string | null;
    employeeId: string | null;
  };
}): AttendanceCorrectionDto {
  return {
    id: row.id,
    employeeId: row.employeeId,
    attendanceRecordId: row.attendanceRecordId,
    attendanceDate: row.attendanceDate.toISOString().slice(0, 10),
    correctionType:
      row.correctionType as AttendanceCorrectionDto["correctionType"],
    reason: row.reason,
    comments: row.comments,
    status: row.status as AttendanceCorrectionStatus,
    proposedCheckIn: row.proposedCheckIn?.toISOString() ?? null,
    proposedCheckOut: row.proposedCheckOut?.toISOString() ?? null,
    proposedWorkMode: row.proposedWorkMode as AttendanceWorkMode | null,
    approvedBy: row.approvedBy,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    rejectRemarks: row.rejectRemarks,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    employee: row.employee,
  };
}

export class AttendanceCorrectionService {
  private canApprove(actorPermissions: string[]): boolean {
    return (
      actorPermissions.includes(
        PERMISSIONS.HRMS_ATTENDANCE_CORRECTION_APPROVE,
      ) || actorPermissions.includes(PERMISSIONS.HRMS_ATTENDANCE_MANAGE)
    );
  }

  private canViewAll(actorPermissions: string[]): boolean {
    return (
      actorPermissions.includes(PERMISSIONS.HRMS_ATTENDANCE_MANAGE) ||
      actorPermissions.includes(PERMISSIONS.HRMS_ATTENDANCE_READ)
    );
  }

  async create(actorId: string, input: CreateCorrectionInput) {
    const date = toDateOnly(input.attendanceDate);
    const pending = await attendanceCorrectionRepository.findMany(
      { employeeId: actorId, attendanceDate: date, status: "pending" },
      1,
      1,
    );
    if (pending.total > 0) {
      throw new BadRequestException(
        "A pending correction already exists for this date",
      );
    }

    const row = await attendanceCorrectionRepository.create({
      employeeId: actorId,
      attendanceRecordId: input.attendanceRecordId ?? null,
      attendanceDate: date,
      correctionType: input.correctionType,
      reason: input.reason,
      comments: input.comments ?? null,
      proposedCheckIn: input.proposedCheckIn
        ? new Date(input.proposedCheckIn)
        : null,
      proposedCheckOut: input.proposedCheckOut
        ? new Date(input.proposedCheckOut)
        : null,
      proposedWorkMode: input.proposedWorkMode ?? null,
      status: "pending",
    });

    await attendanceRepository.createAuditLog({
      employeeId: actorId,
      actorId,
      action: "correction_requested",
      details: { correctionId: row.id, correctionType: input.correctionType },
    });

    void attendanceNotificationService.notifyPendingCorrection(row);

    return serializeCorrection(row);
  }

  async list(
    actorId: string,
    actorPermissions: string[],
    query: CorrectionsQuery,
  ) {
    const where: Parameters<typeof attendanceCorrectionRepository.findMany>[0] =
      {};

    if (query.status) where.status = query.status;

    if (query.scope === "all" && this.canViewAll(actorPermissions)) {
      if (query.employeeId) where.employeeId = query.employeeId;
    } else if (
      query.scope === "team" &&
      (this.canApprove(actorPermissions) ||
        (await leaveRepository.findDirectReportIds(actorId)).length > 0)
    ) {
      const reportIds = await leaveRepository.findDirectReportIds(actorId);
      where.employeeId = query.employeeId
        ? reportIds.includes(query.employeeId)
          ? query.employeeId
          : actorId
        : { in: reportIds.length ? reportIds : [actorId] };
    } else {
      where.employeeId = actorId;
    }

    const { data, total } = await attendanceCorrectionRepository.findMany(
      where,
      query.page,
      query.limit,
    );

    return {
      data: data.map(serializeCorrection),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit) || 1,
      },
    };
  }

  private async assertCanActOnCorrection(
    actorId: string,
    actorPermissions: string[],
    correction: { employeeId: string },
  ) {
    // Segregation of duties: nobody approves/rejects their own correction,
    // even an approver/HR. A second eligible approver must act on it.
    if (correction.employeeId === actorId) {
      throw new ForbiddenException(
        "You cannot approve or reject your own correction",
      );
    }

    if (this.canApprove(actorPermissions)) return;

    const reportIds = await leaveRepository.findDirectReportIds(actorId);
    if (reportIds.includes(correction.employeeId)) return;

    throw new ForbiddenException(
      "You do not have permission to act on this correction",
    );
  }

  async approve(actorId: string, actorPermissions: string[], id: string) {
    const correction = await attendanceCorrectionRepository.findById(id);
    if (!correction) throw new NotFoundException("Correction not found");
    if (correction.status !== "pending") {
      throw new BadRequestException("Correction is not pending");
    }

    await this.assertCanActOnCorrection(actorId, actorPermissions, correction);

    let record = correction.attendanceRecordId
      ? await prisma.attendanceRecord.findUnique({
          where: { id: correction.attendanceRecordId },
        })
      : await attendanceRepository.findRecordByEmployeeAndDate(
          correction.employeeId,
          correction.attendanceDate,
        );

    const updateData: Record<string, unknown> = {};
    if (correction.proposedCheckIn) {
      updateData.checkIn = correction.proposedCheckIn;
    }
    if (correction.proposedCheckOut) {
      updateData.checkOut = correction.proposedCheckOut;
    }
    if (correction.proposedWorkMode) {
      updateData.workMode = correction.proposedWorkMode;
    }
    if (correction.proposedCheckIn || correction.proposedWorkMode) {
      updateData.status = "present";
    }

    if (record) {
      record = await attendanceRepository.updateRecord(record.id, updateData);
    } else if (Object.keys(updateData).length > 0) {
      record = await attendanceRepository.createRecord({
        employeeId: correction.employeeId,
        attendanceDate: correction.attendanceDate,
        checkIn: correction.proposedCheckIn ?? null,
        checkOut: correction.proposedCheckOut ?? null,
        workMode:
          (correction.proposedWorkMode as AttendanceWorkMode) ?? "office",
        status: "present",
        lateMinutes: 0,
      });
    }

    const updated = await attendanceCorrectionRepository.update(id, {
      status: "approved",
      approvedBy: actorId,
      approvedAt: new Date(),
      attendanceRecordId: record?.id ?? correction.attendanceRecordId,
    });

    await attendanceRepository.createAuditLog({
      recordId: record?.id ?? null,
      employeeId: correction.employeeId,
      actorId,
      action: "correction_approved",
      details: { correctionId: id },
    });

    void attendanceNotificationService.notifyCorrectionApproved(updated);

    return serializeCorrection(updated);
  }

  async reject(
    actorId: string,
    actorPermissions: string[],
    id: string,
    remarks: string,
  ) {
    const correction = await attendanceCorrectionRepository.findById(id);
    if (!correction) throw new NotFoundException("Correction not found");
    if (correction.status !== "pending") {
      throw new BadRequestException("Correction is not pending");
    }

    await this.assertCanActOnCorrection(actorId, actorPermissions, correction);

    const updated = await attendanceCorrectionRepository.update(id, {
      status: "rejected",
      approvedBy: actorId,
      approvedAt: new Date(),
      rejectRemarks: remarks,
    });

    await attendanceRepository.createAuditLog({
      employeeId: correction.employeeId,
      actorId,
      action: "correction_rejected",
      details: { correctionId: id, remarks },
    });

    void attendanceNotificationService.notifyCorrectionRejected(updated);

    return serializeCorrection(updated);
  }
}

export const attendanceCorrectionService = new AttendanceCorrectionService();
