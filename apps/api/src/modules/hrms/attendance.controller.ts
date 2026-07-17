import { Router } from "express";

import { PERMISSIONS } from "@/common/constants/permissions";
import {
  authenticate,
  requireActive,
  requirePermission,
} from "@/core/guards/auth.guard";
import { asyncHandler } from "@/core/middleware/async-handler";
import { attendanceService } from "@/modules/hrms/attendance.service";
import {
  checkInSchema,
  checkOutSchema,
  departmentReportQuerySchema,
  monthlyReportQuerySchema,
  myAttendanceQuerySchema,
} from "@/modules/hrms/attendance.validation";

const router = Router();

router.use(authenticate, requireActive);

router.post(
  "/attendance/check-in",
  requirePermission(
    PERMISSIONS.HRMS_READ,
    PERMISSIONS.HRMS_ATTENDANCE_READ,
    PERMISSIONS.HRMS_ATTENDANCE_MANAGE,
  ),
  asyncHandler(async (req, res) => {
    const body = checkInSchema.parse(req.body);
    const data = await attendanceService.checkIn(req.user!.id, body);
    res.status(201).json({ data });
  }),
);

router.post(
  "/attendance/check-out",
  requirePermission(
    PERMISSIONS.HRMS_READ,
    PERMISSIONS.HRMS_ATTENDANCE_READ,
    PERMISSIONS.HRMS_ATTENDANCE_MANAGE,
  ),
  asyncHandler(async (req, res) => {
    const body = checkOutSchema.parse(req.body);
    const data = await attendanceService.checkOut(req.user!.id, body);
    res.json({ data });
  }),
);

router.get(
  "/attendance/today",
  requirePermission(
    PERMISSIONS.HRMS_READ,
    PERMISSIONS.HRMS_ATTENDANCE_READ,
    PERMISSIONS.HRMS_ATTENDANCE_MANAGE,
  ),
  asyncHandler(async (req, res) => {
    const data = await attendanceService.getToday(req.user!.id);
    res.json({ data });
  }),
);

router.get(
  "/attendance/live",
  requirePermission(
    PERMISSIONS.HRMS_ATTENDANCE_READ,
    PERMISSIONS.HRMS_ATTENDANCE_MANAGE,
  ),
  asyncHandler(async (req, res) => {
    const data = await attendanceService.getLive(
      req.user!.id,
      req.user!.permissions,
    );
    res.json({ data });
  }),
);

router.get(
  "/attendance/dashboard",
  requirePermission(
    PERMISSIONS.HRMS_ATTENDANCE_READ,
    PERMISSIONS.HRMS_ATTENDANCE_MANAGE,
  ),
  asyncHandler(async (req, res) => {
    const data = await attendanceService.getDashboard(req.user!.permissions);
    res.json({ data });
  }),
);

router.get(
  "/attendance/my-attendance",
  requirePermission(
    PERMISSIONS.HRMS_READ,
    PERMISSIONS.HRMS_ATTENDANCE_READ,
    PERMISSIONS.HRMS_ATTENDANCE_MANAGE,
  ),
  asyncHandler(async (req, res) => {
    const query = myAttendanceQuerySchema.parse(req.query);
    const result = await attendanceService.getMyAttendance(req.user!.id, query);
    res.json(result);
  }),
);

router.get(
  "/attendance/report/monthly",
  requirePermission(
    PERMISSIONS.HRMS_READ,
    PERMISSIONS.HRMS_ATTENDANCE_READ,
    PERMISSIONS.HRMS_ATTENDANCE_MANAGE,
  ),
  asyncHandler(async (req, res) => {
    const query = monthlyReportQuerySchema.parse(req.query);
    const data = await attendanceService.getMonthlyReport(
      req.user!.id,
      req.user!.permissions,
      query,
    );
    res.json({ data });
  }),
);

router.get(
  "/attendance/report/department",
  requirePermission(
    PERMISSIONS.HRMS_ATTENDANCE_READ,
    PERMISSIONS.HRMS_ATTENDANCE_MANAGE,
  ),
  asyncHandler(async (req, res) => {
    const query = departmentReportQuerySchema.parse(req.query);
    const data = await attendanceService.getDepartmentReport(
      req.user!.permissions,
      query,
    );
    res.json({ data });
  }),
);

export default router;
