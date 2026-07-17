import { Router } from "express";

import { PERMISSIONS } from "@/common/constants/permissions";
import {
  authenticate,
  requireActive,
  requirePermission,
} from "@/core/guards/auth.guard";
import { asyncHandler } from "@/core/middleware/async-handler";
import { attendanceCalendarViewService } from "@/modules/hrms/attendance-calendar-view.service";
import { attendanceExecutiveService } from "@/modules/hrms/attendance-executive.service";
import {
  type BulkAssignShiftInput,
  bulkAssignShiftSchema,
  type CalendarQuery,
  calendarQuerySchema,
  changeShiftAssignmentSchema,
  employeeProfileQuerySchema,
  executiveAnalyticsQuerySchema,
  shiftAssignmentsQuerySchema,
} from "@/modules/hrms/attendance-phase3.validation";
import { attendanceShiftService } from "@/modules/hrms/attendance-shift.service";

const router = Router();
router.use(authenticate, requireActive);

const selfAttendancePerms = [
  PERMISSIONS.HRMS_READ,
  PERMISSIONS.HRMS_ATTENDANCE_READ,
  PERMISSIONS.HRMS_ATTENDANCE_MANAGE,
];

router.get(
  "/attendance/calendar",
  requirePermission(...selfAttendancePerms),
  asyncHandler(async (req, res) => {
    const query = calendarQuerySchema.parse(req.query) as CalendarQuery;
    const data = await attendanceCalendarViewService.getCalendar(
      req.user!.id,
      req.user!.permissions,
      query,
    );
    res.json({ data });
  }),
);

router.get(
  "/attendance/executive-analytics",
  requirePermission(
    PERMISSIONS.HRMS_ATTENDANCE_READ,
    PERMISSIONS.HRMS_ATTENDANCE_MANAGE,
  ),
  asyncHandler(async (req, res) => {
    const query = executiveAnalyticsQuerySchema.parse(req.query);
    const data = await attendanceExecutiveService.getExecutiveAnalytics(
      req.user!.permissions,
      query,
    );
    res.json({ data });
  }),
);

router.get(
  "/attendance/employees/:employeeId/profile",
  requirePermission(...selfAttendancePerms),
  asyncHandler(async (req, res) => {
    const query = employeeProfileQuerySchema.parse(req.query);
    const targetId = req.params.employeeId as string;
    const canViewOthers =
      req.user!.permissions.includes(PERMISSIONS.HRMS_ATTENDANCE_MANAGE) ||
      req.user!.permissions.includes(PERMISSIONS.HRMS_ATTENDANCE_READ) ||
      targetId === req.user!.id;
    if (!canViewOthers) {
      res.status(403).json({
        error: { code: "forbidden", message: "Cannot view this profile" },
      });
      return;
    }
    const data = await attendanceExecutiveService.getEmployeeProfileSummary(
      targetId,
      query.month,
    );
    if (!data) {
      res.status(404).json({
        error: { code: "not_found", message: "Employee not found" },
      });
      return;
    }
    res.json({ data });
  }),
);

router.get(
  "/attendance/shift-assignments",
  requirePermission(PERMISSIONS.HRMS_ATTENDANCE_POLICY_MANAGE),
  asyncHandler(async (req, res) => {
    const query = shiftAssignmentsQuerySchema.parse(req.query);
    const data = await attendanceShiftService.listAssignments(
      query.entityId ?? null,
    );
    res.json({ data });
  }),
);

router.post(
  "/attendance/shift-assignments/bulk",
  requirePermission(PERMISSIONS.HRMS_ATTENDANCE_POLICY_MANAGE),
  asyncHandler(async (req, res) => {
    const body: BulkAssignShiftInput = bulkAssignShiftSchema.parse(req.body);
    const data = await attendanceShiftService.bulkAssign(body);
    res.status(201).json({ data });
  }),
);

router.put(
  "/attendance/shift-assignments/:id",
  requirePermission(PERMISSIONS.HRMS_ATTENDANCE_POLICY_MANAGE),
  asyncHandler(async (req, res) => {
    const body = changeShiftAssignmentSchema.parse(req.body);
    const data = await attendanceShiftService.changeAssignment(
      req.params.id as string,
      body,
    );
    res.json({ data });
  }),
);

export default router;
