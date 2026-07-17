import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  BadRequestException,
  ForbiddenException,
} from "@/common/exceptions/http-exception";
import { attendanceCorrectionRepository } from "@/modules/hrms/attendance-correction.repository";
import { AttendanceCorrectionService } from "@/modules/hrms/attendance-correction.service";
import { leaveRepository } from "@/modules/leave/leave.repository";

vi.mock("@/modules/hrms/attendance-correction.repository", () => ({
  attendanceCorrectionRepository: {
    findById: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/modules/hrms/attendance.repository", () => ({
  attendanceRepository: {
    findRecordByEmployeeAndDate: vi.fn(),
    updateRecord: vi.fn(),
    createRecord: vi.fn(),
    createAuditLog: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock("@/modules/leave/leave.repository", () => ({
  leaveRepository: { findDirectReportIds: vi.fn().mockResolvedValue([]) },
}));

vi.mock("@/modules/hrms/attendance-notification.service", () => ({
  attendanceNotificationService: {
    notifyCorrectionApproved: vi.fn(),
    notifyCorrectionRejected: vi.fn(),
  },
}));

vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: { attendanceRecord: { findUnique: vi.fn() } },
}));

const MANAGE = ["hrms:attendance-manage"];
const EMPLOYEE_ID = "user-1";
const APPROVER_ID = "approver-1";

function correctionStub(over: Record<string, unknown> = {}) {
  return {
    id: "corr-1",
    employeeId: EMPLOYEE_ID,
    attendanceRecordId: null,
    attendanceDate: new Date("2026-06-12T00:00:00.000Z"),
    correctionType: "missed_check_in",
    reason: "forgot",
    comments: null,
    status: "pending",
    proposedCheckIn: null,
    proposedCheckOut: null,
    proposedWorkMode: null,
    approvedBy: null,
    approvedAt: null,
    rejectRemarks: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  } as never;
}

describe("AttendanceCorrectionService authz", () => {
  const service = new AttendanceCorrectionService();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("approves a pending correction for an HR/approver actor", async () => {
    vi.mocked(attendanceCorrectionRepository.findById).mockResolvedValue(
      correctionStub(),
    );
    vi.mocked(attendanceCorrectionRepository.update).mockResolvedValue(
      correctionStub({ status: "approved", approvedBy: APPROVER_ID }),
    );

    const result = await service.approve(APPROVER_ID, MANAGE, "corr-1");

    expect(result.status).toBe("approved");
    expect(attendanceCorrectionRepository.update).toHaveBeenCalledWith(
      "corr-1",
      expect.objectContaining({ status: "approved", approvedBy: APPROVER_ID }),
    );
  });

  it("rejects a non-pending correction (double action guard)", async () => {
    vi.mocked(attendanceCorrectionRepository.findById).mockResolvedValue(
      correctionStub({ status: "approved" }),
    );
    await expect(
      service.approve(APPROVER_ID, MANAGE, "corr-1"),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(attendanceCorrectionRepository.update).not.toHaveBeenCalled();
  });

  it("forbids approving your own correction even as an approver", async () => {
    vi.mocked(attendanceCorrectionRepository.findById).mockResolvedValue(
      correctionStub({ employeeId: APPROVER_ID }),
    );
    await expect(
      service.approve(APPROVER_ID, MANAGE, "corr-1"),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(attendanceCorrectionRepository.update).not.toHaveBeenCalled();
  });

  it("forbids a non-approver who does not manage the employee", async () => {
    vi.mocked(attendanceCorrectionRepository.findById).mockResolvedValue(
      correctionStub(),
    );
    vi.mocked(leaveRepository.findDirectReportIds).mockResolvedValue([]);
    await expect(
      service.approve("stranger-1", ["hrms:read"], "corr-1"),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("allows the employee's direct manager to act without the approve perm", async () => {
    vi.mocked(attendanceCorrectionRepository.findById).mockResolvedValue(
      correctionStub(),
    );
    vi.mocked(leaveRepository.findDirectReportIds).mockResolvedValue([
      EMPLOYEE_ID,
    ]);
    vi.mocked(attendanceCorrectionRepository.update).mockResolvedValue(
      correctionStub({ status: "rejected", rejectRemarks: "no proof" }),
    );

    const result = await service.reject(
      "manager-1",
      ["hrms:read"],
      "corr-1",
      "no proof",
    );

    expect(result.status).toBe("rejected");
    expect(attendanceCorrectionRepository.update).toHaveBeenCalledWith(
      "corr-1",
      expect.objectContaining({
        status: "rejected",
        rejectRemarks: "no proof",
      }),
    );
  });
});
