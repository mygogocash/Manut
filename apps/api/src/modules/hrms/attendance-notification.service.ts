import { prisma } from "@/infrastructure/database/prisma";
import { sendEmail } from "@/infrastructure/email/email.service";
import { attendanceRepository } from "@/modules/hrms/attendance.repository";
import { attendanceCalendarService } from "@/modules/hrms/attendance-calendar.service";
import { leaveRepository } from "@/modules/leave/leave.repository";

// Number of true absentees among a manager's reports that triggers the
// high-absenteeism alert (tunable code constant, per CLAUDE.md).
const HIGH_ABSENTEEISM_THRESHOLD = 3;

async function getUserEmail(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  });
  return user?.email ?? null;
}

export const attendanceNotificationService = {
  async notifyPendingCorrection(correction: {
    id: string;
    employeeId: string;
    attendanceDate: Date;
    correctionType: string;
    employee?: { name: string; email: string };
  }) {
    const employee =
      correction.employee ??
      (await prisma.user.findUnique({
        where: { id: correction.employeeId },
        select: { name: true, email: true, reportingTo: true },
      }));
    if (!employee) return;

    const recipients: string[] = [];
    if ("reportingTo" in employee && employee.reportingTo) {
      const mgrEmail = await getUserEmail(employee.reportingTo as string);
      if (mgrEmail) recipients.push(mgrEmail);
    } else {
      const emp = await prisma.user.findUnique({
        where: { id: correction.employeeId },
        select: { reportingTo: true },
      });
      if (emp?.reportingTo) {
        const mgrEmail = await getUserEmail(emp.reportingTo);
        if (mgrEmail) recipients.push(mgrEmail);
      }
    }

    if (!recipients.length) return;

    const dateStr = correction.attendanceDate.toISOString().slice(0, 10);
    void sendEmail({
      to: recipients,
      templateId: "attendance-correction-pending",
      variables: {
        employeeName: employee.name,
        date: dateStr,
        correctionType: correction.correctionType,
      },
    });
  },

  async notifyCorrectionApproved(correction: {
    employeeId: string;
    attendanceDate: Date;
    employee?: { name: string; email: string };
  }) {
    const email =
      correction.employee?.email ?? (await getUserEmail(correction.employeeId));
    if (!email) return;

    const dateStr = correction.attendanceDate.toISOString().slice(0, 10);
    void sendEmail({
      to: email,
      templateId: "attendance-correction-approved",
      variables: { date: dateStr },
    });
  },

  async notifyCorrectionRejected(correction: {
    employeeId: string;
    attendanceDate: Date;
    rejectRemarks: string | null;
    employee?: { name: string; email: string };
  }) {
    const email =
      correction.employee?.email ?? (await getUserEmail(correction.employeeId));
    if (!email) return;

    const dateStr = correction.attendanceDate.toISOString().slice(0, 10);
    void sendEmail({
      to: email,
      templateId: "attendance-correction-rejected",
      variables: { date: dateStr, remarks: correction.rejectRemarks ?? "" },
    });
  },

  async notifyMissedCheckIn(employeeId: string, date: string) {
    const email = await getUserEmail(employeeId);
    if (!email) return;
    void sendEmail({
      to: email,
      templateId: "attendance-missed-checkin",
      variables: { date },
    });
  },

  async notifyMissedCheckOut(employeeId: string, date: string) {
    const email = await getUserEmail(employeeId);
    if (!email) return;
    void sendEmail({
      to: email,
      templateId: "attendance-missed-checkout",
      variables: { date },
    });
  },

  async notifyManagerHighAbsenteeism(
    managerId: string,
    absentCount: number,
    date: string,
  ) {
    const email = await getUserEmail(managerId);
    if (!email) return;
    void sendEmail({
      to: email,
      templateId: "attendance-manager-absentee",
      variables: { absentCount, date },
    });
  },

  async notifyManagerLateAlerts(
    managerId: string,
    lateNames: string[],
    date: string,
  ) {
    if (!lateNames.length) return;
    const email = await getUserEmail(managerId);
    if (!email) return;
    void sendEmail({
      to: email,
      templateId: "attendance-manager-late",
      variables: {
        date,
        count: lateNames.length,
        names: lateNames.join(", "),
      },
    });
  },

  async notifyManagerMissedAttendance(
    managerId: string,
    employeeCount: number,
    date: string,
  ) {
    if (employeeCount <= 0) return;
    const email = await getUserEmail(managerId);
    if (!email) return;
    void sendEmail({
      to: email,
      templateId: "attendance-manager-missed",
      variables: { employeeCount, date },
    });
  },

  async notifyManagerPendingCorrections(managerId: string, count: number) {
    if (count <= 0) return;
    const email = await getUserEmail(managerId);
    if (!email) return;
    void sendEmail({
      to: email,
      templateId: "attendance-manager-pending-corrections",
      variables: { count },
    });
  },

  async runDailyManagerAlerts() {
    const today = new Date();
    const dateOnly = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
    );
    const dateStr = dateOnly.toISOString().slice(0, 10);

    const managers = await prisma.user.findMany({
      where: { isActive: true, directReports: { some: { isActive: true } } },
      select: { id: true },
    });

    for (const mgr of managers) {
      const reportIds = await leaveRepository.findDirectReportIds(mgr.id);
      if (!reportIds.length) continue;

      // Idempotency: one digest per manager per day. A re-run (or retry)
      // finds the marker and skips, so reminders are never duplicated.
      const alreadySent = await prisma.attendanceAuditLog.findFirst({
        where: {
          employeeId: mgr.id,
          action: "manager_daily_alert",
          details: { path: ["date"], equals: dateStr },
        },
        select: { id: true },
      });
      if (alreadySent) continue;

      const reports = await prisma.user.findMany({
        where: { id: { in: reportIds } },
        select: { id: true, entityId: true },
      });
      const records = await prisma.attendanceRecord.findMany({
        where: { employeeId: { in: reportIds }, attendanceDate: dateOnly },
        include: { employee: { select: { name: true } } },
      });

      const lateNames = records
        .filter((r) => r.status === "late")
        .map((r) => r.employee.name);

      // A report counts as absent only when it is a working day for them
      // (not weekend/holiday/leave/exception) and they have no attendance —
      // mirrors getDashboard's virtualAbsent derivation rather than
      // subtracting record counts (which over/under-counts).
      const recordByEmp = new Map(records.map((r) => [r.employeeId, r]));
      const PRESENT_STATUSES = new Set([
        "present",
        "late",
        "remote",
        "hybrid",
        "on_leave",
      ]);
      let absentCount = 0;
      for (const rep of reports) {
        const rec = recordByEmp.get(rep.id);
        if (rec && (rec.checkIn !== null || PRESENT_STATUSES.has(rec.status))) {
          continue;
        }
        const classified =
          await attendanceCalendarService.classifyNonWorkingDay(
            rep.id,
            rep.entityId ?? null,
            dateOnly,
          );
        if (!classified) absentCount++;
      }

      const pending = await prisma.attendanceCorrection.count({
        where: { employeeId: { in: reportIds }, status: "pending" },
      });

      if (lateNames.length) {
        await this.notifyManagerLateAlerts(mgr.id, lateNames, dateStr);
      }
      if (pending > 0) {
        await this.notifyManagerPendingCorrections(mgr.id, pending);
      }
      if (absentCount >= HIGH_ABSENTEEISM_THRESHOLD) {
        await this.notifyManagerHighAbsenteeism(mgr.id, absentCount, dateStr);
      }

      await attendanceRepository.createAuditLog({
        recordId: null,
        employeeId: mgr.id,
        actorId: null,
        action: "manager_daily_alert",
        details: { date: dateStr },
      });
    }
  },
};
