import { prisma } from "@/infrastructure/database/prisma";
import { attendanceRepository } from "@/modules/hrms/attendance.repository";
import { attendanceCalendarService } from "@/modules/hrms/attendance-calendar.service";
import { attendanceNotificationService } from "@/modules/hrms/attendance-notification.service";
import {
  attendanceDateFromInstant,
  COMPANY_DEFAULT_TIMEZONE,
  formatDateYmdUtc,
  resolveEmployeeTimezone,
  zonedLocalToUtc,
} from "@/modules/hrms/attendance-timezone.util";
import { leaveRepository } from "@/modules/leave/leave.repository";

// Dedup guard: has this notification action already been recorded for this
// subject on this local day? Keyed on the AttendanceAuditLog `details.date`
// so the hourly cron is idempotent and never re-sends the same reminder.
async function alreadyNotified(
  subjectId: string,
  action: string,
  dateStr: string,
): Promise<boolean> {
  const existing = await prisma.attendanceAuditLog.findFirst({
    where: {
      employeeId: subjectId,
      action,
      details: { path: ["date"], equals: dateStr },
    },
    select: { id: true },
  });
  return existing !== null;
}

export const attendanceMissedService = {
  async runMissedAttendanceChecks() {
    const now = new Date();
    const employees = await prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        email: true,
        entityId: true,
        timezone: true,
        reportingTo: true,
      },
    });

    let missedCheckIns = 0;
    let missedCheckOuts = 0;
    let managerAlerts = 0;

    for (const emp of employees) {
      const policy = await attendanceRepository.findPolicyForEntity(
        emp.entityId ?? null,
      );
      const companyTz = policy?.defaultTimezone ?? COMPANY_DEFAULT_TIMEZONE;
      const employeeTz = resolveEmployeeTimezone(emp.timezone, companyTz);
      const today = attendanceDateFromInstant(now, employeeTz);
      const dateStr = formatDateYmdUtc(today);

      const classified = await attendanceCalendarService.classifyNonWorkingDay(
        emp.id,
        emp.entityId ?? null,
        today,
      );
      if (classified) continue;

      const record = await attendanceRepository.findRecordByEmployeeAndDate(
        emp.id,
        today,
      );

      const shiftStart = policy?.shiftStartTime ?? "09:00";
      const shiftEnd = policy?.shiftEndTime ?? "18:00";
      const missedCheckInAfter = policy?.missedCheckInAfterMinutes ?? 120;
      const missedCheckOutAfter = policy?.missedCheckOutAfterMinutes ?? 60;

      const checkInDeadline = new Date(
        zonedLocalToUtc(dateStr, shiftStart, employeeTz).getTime() +
          missedCheckInAfter * 60_000,
      );
      const checkOutDeadline = new Date(
        zonedLocalToUtc(dateStr, shiftEnd, employeeTz).getTime() +
          missedCheckOutAfter * 60_000,
      );

      if (
        !record?.checkIn &&
        now >= checkInDeadline &&
        !(await alreadyNotified(emp.id, "missed_checkin_notified", dateStr))
      ) {
        await attendanceNotificationService.notifyMissedCheckIn(
          emp.id,
          dateStr,
        );
        await attendanceRepository.createAuditLog({
          recordId: record?.id ?? null,
          employeeId: emp.id,
          actorId: null,
          action: "missed_checkin_notified",
          details: { date: dateStr },
        });
        missedCheckIns++;
      }

      if (
        record?.checkIn &&
        !record.checkOut &&
        now >= checkOutDeadline &&
        !(await alreadyNotified(emp.id, "missed_checkout_notified", dateStr))
      ) {
        await attendanceNotificationService.notifyMissedCheckOut(
          emp.id,
          dateStr,
        );
        await attendanceRepository.createAuditLog({
          recordId: record.id,
          employeeId: emp.id,
          actorId: null,
          action: "missed_checkout_notified",
          details: { date: dateStr },
        });
        missedCheckOuts++;
      }
    }

    // employeeId -> tz context, reused for the manager streak loop below.
    const empById = new Map(employees.map((e) => [e.id, e]));

    const managers = await prisma.user.findMany({
      where: { isActive: true, directReports: { some: { isActive: true } } },
      select: { id: true },
    });

    const consecutiveDays =
      (await attendanceRepository.findPolicyForEntity(null))
        ?.consecutiveAbsenceAlertDays ?? 3;

    for (const mgr of managers) {
      const reportIds = await leaveRepository.findDirectReportIds(mgr.id);
      if (!reportIds.length) continue;

      let missedCount = 0;
      for (const empId of reportIds) {
        // Resolve the report's own timezone so the day window matches how
        // their records are stamped (falls back to company default).
        const reportEmp = empById.get(empId);
        const reportTz = resolveEmployeeTimezone(
          reportEmp?.timezone,
          COMPANY_DEFAULT_TIMEZONE,
        );
        let streak = 0;
        const cursor = attendanceDateFromInstant(now, reportTz);
        // Start at yesterday (d=1): today is still in progress, so a missing
        // record today is not yet an absence.
        for (let d = 1; d <= consecutiveDays; d++) {
          const day = new Date(cursor);
          day.setUTCDate(day.getUTCDate() - d);
          const classified =
            await attendanceCalendarService.classifyNonWorkingDay(
              empId,
              reportEmp?.entityId ?? null,
              day,
            );
          if (classified) break;
          const rec = await attendanceRepository.findRecordByEmployeeAndDate(
            empId,
            day,
          );
          const absent = !rec || (rec.status === "absent" && !rec.checkIn);
          if (absent) streak++;
          else break;
        }
        if (streak >= consecutiveDays) missedCount++;
      }

      const mgrDateStr = formatDateYmdUtc(
        attendanceDateFromInstant(now, COMPANY_DEFAULT_TIMEZONE),
      );
      if (
        missedCount > 0 &&
        !(await alreadyNotified(mgr.id, "manager_missed_alert", mgrDateStr))
      ) {
        await attendanceNotificationService.notifyManagerMissedAttendance(
          mgr.id,
          missedCount,
          mgrDateStr,
        );
        await attendanceRepository.createAuditLog({
          recordId: null,
          employeeId: mgr.id,
          actorId: null,
          action: "manager_missed_alert",
          details: { date: mgrDateStr },
        });
        managerAlerts++;
      }
    }

    return {
      missedCheckIns,
      missedCheckOuts,
      managerAlerts,
    };
  },
};
