import { Router } from "express";

import { PERMISSIONS } from "@/common/constants/permissions";
import {
  authenticate,
  requireActive,
  requirePermission,
} from "@/core/guards/auth.guard";
import { asyncHandler } from "@/core/middleware/async-handler";
import { attendanceAnalyticsService } from "@/modules/hrms/attendance-analytics.service";
import { attendanceCorrectionService } from "@/modules/hrms/attendance-correction.service";
import { attendanceExceptionService } from "@/modules/hrms/attendance-exception.service";
import { attendanceExportService } from "@/modules/hrms/attendance-export.service";
import { attendanceManagerService } from "@/modules/hrms/attendance-manager.service";
import {
  analyticsQuerySchema,
  assignShiftSchema,
  correctionsQuerySchema,
  createCorrectionSchema,
  createExceptionSchema,
  createShiftSchema,
  exceptionsQuerySchema,
  exportQuerySchema,
  policyQuerySchema,
  rejectCorrectionSchema,
  updatePolicySchema,
  updateShiftSchema,
} from "@/modules/hrms/attendance-phase2.validation";
import { attendancePolicyService } from "@/modules/hrms/attendance-policy.service";
import { attendanceShiftService } from "@/modules/hrms/attendance-shift.service";

const router = Router();

router.use(authenticate, requireActive);

const selfAttendancePerms = [
  PERMISSIONS.HRMS_READ,
  PERMISSIONS.HRMS_ATTENDANCE_READ,
  PERMISSIONS.HRMS_ATTENDANCE_MANAGE,
];

// ─── Corrections ─────────────────────────────────────────

router.post(
  "/attendance/corrections",
  requirePermission(...selfAttendancePerms),
  asyncHandler(async (req, res) => {
    const body = createCorrectionSchema.parse(req.body);
    const data = await attendanceCorrectionService.create(req.user!.id, body);
    res.status(201).json({ data });
  }),
);

router.get(
  "/attendance/corrections",
  requirePermission(...selfAttendancePerms),
  asyncHandler(async (req, res) => {
    const query = correctionsQuerySchema.parse(req.query);
    const result = await attendanceCorrectionService.list(
      req.user!.id,
      req.user!.permissions,
      query,
    );
    res.json(result);
  }),
);

router.post(
  "/attendance/corrections/:id/approve",
  requirePermission(
    PERMISSIONS.HRMS_ATTENDANCE_CORRECTION_APPROVE,
    PERMISSIONS.HRMS_ATTENDANCE_MANAGE,
  ),
  asyncHandler(async (req, res) => {
    const data = await attendanceCorrectionService.approve(
      req.user!.id,
      req.user!.permissions,
      req.params.id as string,
    );
    res.json({ data });
  }),
);

router.post(
  "/attendance/corrections/:id/reject",
  requirePermission(
    PERMISSIONS.HRMS_ATTENDANCE_CORRECTION_APPROVE,
    PERMISSIONS.HRMS_ATTENDANCE_MANAGE,
  ),
  asyncHandler(async (req, res) => {
    const body = rejectCorrectionSchema.parse(req.body);
    const data = await attendanceCorrectionService.reject(
      req.user!.id,
      req.user!.permissions,
      req.params.id as string,
      body.remarks,
    );
    res.json({ data });
  }),
);

// ─── Policy & Settings ─────────────────────────────────

router.get(
  "/attendance/policy",
  requirePermission(
    PERMISSIONS.HRMS_ATTENDANCE_READ,
    PERMISSIONS.HRMS_ATTENDANCE_MANAGE,
    PERMISSIONS.HRMS_ATTENDANCE_POLICY_MANAGE,
  ),
  asyncHandler(async (req, res) => {
    const query = policyQuerySchema.parse(req.query);
    const data = await attendancePolicyService.get(query.entityId ?? null);
    res.json({ data });
  }),
);

router.put(
  "/attendance/policy",
  requirePermission(PERMISSIONS.HRMS_ATTENDANCE_POLICY_MANAGE),
  asyncHandler(async (req, res) => {
    const body = updatePolicySchema.parse(req.body);
    const data = await attendancePolicyService.update(body);
    res.json({ data });
  }),
);

// ─── Exports ─────────────────────────────────────────────

router.get(
  "/attendance/export/daily",
  requirePermission(
    PERMISSIONS.HRMS_ATTENDANCE_REPORT_EXPORT,
    PERMISSIONS.HRMS_ATTENDANCE_MANAGE,
  ),
  asyncHandler(async (req, res) => {
    const query = exportQuerySchema.parse(req.query);
    const { buffer, filename, contentType } =
      await attendanceExportService.exportDaily(query);
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  }),
);

router.get(
  "/attendance/export/monthly",
  requirePermission(
    PERMISSIONS.HRMS_ATTENDANCE_REPORT_EXPORT,
    PERMISSIONS.HRMS_ATTENDANCE_MANAGE,
  ),
  asyncHandler(async (req, res) => {
    const query = exportQuerySchema.parse(req.query);
    const { buffer, filename, contentType } =
      await attendanceExportService.exportMonthly(query);
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  }),
);

router.get(
  "/attendance/export/department",
  requirePermission(
    PERMISSIONS.HRMS_ATTENDANCE_REPORT_EXPORT,
    PERMISSIONS.HRMS_ATTENDANCE_MANAGE,
  ),
  asyncHandler(async (req, res) => {
    const query = exportQuerySchema.parse(req.query);
    const { buffer, filename, contentType } =
      await attendanceExportService.exportDepartment(query);
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  }),
);

// ─── Manager dashboard ───────────────────────────────────

router.get(
  "/attendance/manager/dashboard",
  requirePermission(...selfAttendancePerms),
  asyncHandler(async (req, res) => {
    const data = await attendanceManagerService.getTeamDashboard(
      req.user!.id,
      req.user!.permissions,
    );
    res.json({ data });
  }),
);

// ─── Shifts ──────────────────────────────────────────────

router.get(
  "/attendance/shifts",
  requirePermission(
    PERMISSIONS.HRMS_ATTENDANCE_READ,
    PERMISSIONS.HRMS_ATTENDANCE_MANAGE,
    PERMISSIONS.HRMS_ATTENDANCE_POLICY_MANAGE,
  ),
  asyncHandler(async (req, res) => {
    const entityId =
      typeof req.query.entityId === "string" ? req.query.entityId : undefined;
    const data = await attendanceShiftService.list(entityId ?? null);
    res.json({ data });
  }),
);

router.post(
  "/attendance/shifts",
  requirePermission(PERMISSIONS.HRMS_ATTENDANCE_POLICY_MANAGE),
  asyncHandler(async (req, res) => {
    const body = createShiftSchema.parse(req.body);
    const data = await attendanceShiftService.create(body);
    res.status(201).json({ data });
  }),
);

router.put(
  "/attendance/shifts/:id",
  requirePermission(PERMISSIONS.HRMS_ATTENDANCE_POLICY_MANAGE),
  asyncHandler(async (req, res) => {
    const body = updateShiftSchema.parse(req.body);
    const data = await attendanceShiftService.update(
      req.params.id as string,
      body,
    );
    res.json({ data });
  }),
);

router.post(
  "/attendance/shifts/assign",
  requirePermission(PERMISSIONS.HRMS_ATTENDANCE_POLICY_MANAGE),
  asyncHandler(async (req, res) => {
    const body = assignShiftSchema.parse(req.body);
    const data = await attendanceShiftService.assign(body);
    res.status(201).json({ data });
  }),
);

// ─── Exceptions ──────────────────────────────────────────

router.get(
  "/attendance/exceptions",
  requirePermission(...selfAttendancePerms),
  asyncHandler(async (req, res) => {
    const query = exceptionsQuerySchema.parse(req.query);
    const result = await attendanceExceptionService.list(
      req.user!.id,
      req.user!.permissions,
      query,
    );
    res.json(result);
  }),
);

router.post(
  "/attendance/exceptions",
  requirePermission(...selfAttendancePerms),
  asyncHandler(async (req, res) => {
    const body = createExceptionSchema.parse(req.body);
    const data = await attendanceExceptionService.create(
      req.user!.id,
      req.user!.permissions,
      body,
    );
    res.status(201).json({ data });
  }),
);

// ─── Analytics ───────────────────────────────────────────

router.get(
  "/attendance/analytics",
  requirePermission(
    PERMISSIONS.HRMS_ATTENDANCE_READ,
    PERMISSIONS.HRMS_ATTENDANCE_MANAGE,
  ),
  asyncHandler(async (req, res) => {
    const query = analyticsQuerySchema.parse(req.query);
    const data = await attendanceAnalyticsService.getSummary(
      req.user!.permissions,
      query,
    );
    res.json({ data });
  }),
);

export default router;
