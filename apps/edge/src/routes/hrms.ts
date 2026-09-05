import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { PERMISSIONS } from "@nexora/contracts";
import {
  agreementQuerySchema,
  bulkDeleteEsopGrantsSchema,
  createAgreementSchema,
  createEsopGrantSchema,
  createOffboardingSchema,
  createOnboardingSchema,
  equitySalaryQuerySchema,
  esopGrantQuerySchema,
  offboardingQuerySchema,
  offboardingTemplateSchema,
  onboardingQuerySchema,
  onboardingTemplateSchema,
  replaceOffboardingTasksSchema,
  replaceOnboardingTasksSchema,
  signOffboardingSchema,
  updateAgreementSchema,
  updateEsopGrantSchema,
  updateOffboardingTaskSchema,
  updateOnboardingTaskSchema,
} from "@nexora/contracts/modules/hrms/hrms.validation";
import {
  checkInSchema,
  checkOutSchema,
  departmentReportQuerySchema,
  monthlyReportQuerySchema,
  myAttendanceQuerySchema,
} from "@nexora/contracts/modules/hrms/attendance.validation";
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
} from "@nexora/contracts/modules/hrms/attendance-phase2.validation";
import {
  bulkAssignShiftSchema,
  calendarQuerySchema,
  changeShiftAssignmentSchema,
  employeeProfileQuerySchema,
  executiveAnalyticsQuerySchema,
  shiftAssignmentsQuerySchema,
} from "@nexora/contracts/modules/hrms/attendance-phase3.validation";
import {
  attendanceAnalyticsService,
  attendanceCalendarViewService,
  attendanceCorrectionService,
  attendanceExceptionService,
  attendanceExecutiveService,
  attendanceExportService,
  attendanceManagerService,
  attendancePolicyService,
  attendanceService,
  attendanceShiftService,
  buildEsopImportTemplate,
  hrmsService,
  parseEquitySalaryImportBuffer,
  parseEsopImportBuffer,
  parseR2PrivateKey,
} from "@nexora/core";
import type { AppEnv } from "../lib/context";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/rbac";
import { BadRequestException, ForbiddenException, NotFoundException } from "../lib/errors";

const MULTIPART_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;

const selfAttendancePerms = [
  PERMISSIONS.HRMS_READ,
  PERMISSIONS.HRMS_ATTENDANCE_READ,
  PERMISSIONS.HRMS_ATTENDANCE_MANAGE,
] as const;

const esopTemplateFormatSchema = z.object({
  format: z.enum(["xlsx", "csv"]).optional(),
});

export const hrms = new Hono<AppEnv>()
  // ─── ESOP ───────────────────────────────────────────────
  .get("/esop-pool", requirePermission(PERMISSIONS.HRMS_ESOP_MANAGE), async (c) => {
    const data = await hrmsService.getEsopPool(c.var.db);
    return c.json({ data });
  })
  .get(
    "/esop-grants",
    requirePermission(PERMISSIONS.HRMS_READ, PERMISSIONS.HRMS_ESOP_MANAGE),
    zValidator("query", esopGrantQuerySchema),
    async (c) => {
      const result = await hrmsService.listGrants(
        c.var.db,
        c.req.valid("query"),
        c.var.user!.id,
        c.var.user!.permissions,
      );
      return c.json(result);
    },
  )
  .post(
    "/esop-grants",
    requirePermission(PERMISSIONS.HRMS_ESOP_MANAGE),
    zValidator("json", createEsopGrantSchema),
    async (c) => {
      const data = await hrmsService.createGrant(c.var.db, c.req.valid("json"));
      return c.json({ data }, 201);
    },
  )
  .get(
    "/esop-grants/by-employee/:employeeId",
    requirePermission(PERMISSIONS.HRMS_ESOP_MANAGE),
    async (c) => {
      const data = await hrmsService.getEsopEmployeeSummary(
        c.var.db,
        c.req.param("employeeId"),
      );
      return c.json({ data });
    },
  )
  .get(
    "/esop-grants/import-template",
    requirePermission(PERMISSIONS.HRMS_ESOP_MANAGE),
    zValidator("query", esopTemplateFormatSchema),
    async (c) => {
      const format = c.req.valid("query").format ?? "xlsx";
      const { body, contentType, filename } = buildEsopImportTemplate(format);
      c.header("Content-Disposition", `attachment; filename="${filename}"`);
      c.header("Content-Type", contentType);
      return typeof body === "string"
        ? c.text(body)
        : new Response(body, { headers: { "Content-Type": contentType } });
    },
  )
  .post("/esop-grants/bulk-import", requirePermission(PERMISSIONS.HRMS_ESOP_MANAGE), async (c) => {
    const form = await c.req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new BadRequestException(
        'No file uploaded. Send multipart/form-data with field "file".',
      );
    }
    if (file.size > MULTIPART_UPLOAD_MAX_BYTES) {
      throw new BadRequestException("File exceeds maximum upload size");
    }
    const buffer = await file.arrayBuffer();
    const { parsedRows, parseErrors } = parseEsopImportBuffer(buffer);
    if (parsedRows.length === 0) {
      throw new BadRequestException(
        "No usable rows found. Make sure the sheet has a Name column and at least one grant cell.",
      );
    }
    const replace = String(form.get("replace") ?? "false") === "true";
    const result = await hrmsService.bulkImportGrants(c.var.db, parsedRows, { replace });
    return c.json({ data: { ...result, parseErrors } });
  })
  .post(
    "/esop-grants/bulk-delete",
    requirePermission(PERMISSIONS.HRMS_ESOP_MANAGE),
    zValidator("json", bulkDeleteEsopGrantsSchema),
    async (c) => {
      const data = await hrmsService.bulkDeleteGrants(c.var.db, c.req.valid("json"));
      return c.json({ data });
    },
  )
  .put(
    "/esop-grants/:id",
    requirePermission(PERMISSIONS.HRMS_ESOP_MANAGE),
    zValidator("json", updateEsopGrantSchema),
    async (c) => {
      const data = await hrmsService.updateGrant(
        c.var.db,
        c.req.param("id"),
        c.req.valid("json"),
      );
      return c.json({ data });
    },
  )
  .delete("/esop-grants/:id", requirePermission(PERMISSIONS.HRMS_ESOP_MANAGE), async (c) => {
    await hrmsService.deleteGrant(c.var.db, c.req.param("id"));
    return c.json({ data: { success: true } });
  })
  // ─── Onboarding ─────────────────────────────────────────
  .get(
    "/onboarding",
    requirePermission(PERMISSIONS.HRMS_READ, PERMISSIONS.HRMS_ONBOARDING_MANAGE),
    zValidator("query", onboardingQuerySchema),
    async (c) => {
      const result = await hrmsService.listOnboarding(
        c.var.db,
        c.req.valid("query"),
        c.var.user!.id,
        c.var.user!.permissions,
      );
      return c.json(result);
    },
  )
  .post(
    "/onboarding",
    requirePermission(PERMISSIONS.HRMS_ONBOARDING_MANAGE),
    zValidator("json", createOnboardingSchema),
    async (c) => {
      const data = await hrmsService.createOnboarding(c.var.db, c.req.valid("json"));
      return c.json({ data }, 201);
    },
  )
  .get(
    "/onboarding/template",
    requirePermission(PERMISSIONS.HRMS_READ, PERMISSIONS.HRMS_ONBOARDING_MANAGE),
    async (c) => {
      const data = await hrmsService.getOnboardingTemplate(c.var.db);
      return c.json({ data });
    },
  )
  .put(
    "/onboarding/template",
    requirePermission(PERMISSIONS.HRMS_ONBOARDING_MANAGE),
    zValidator("json", onboardingTemplateSchema),
    async (c) => {
      const data = await hrmsService.setOnboardingTemplate(c.var.db, c.req.valid("json"));
      return c.json({ data });
    },
  )
  .put(
    "/onboarding/:id/task",
    requirePermission(PERMISSIONS.HRMS_ONBOARDING_MANAGE),
    zValidator("json", updateOnboardingTaskSchema),
    async (c) => {
      const data = await hrmsService.updateOnboardingTask(
        c.var.db,
        c.req.param("id"),
        c.req.valid("json"),
      );
      return c.json({ data });
    },
  )
  .put(
    "/onboarding/:id/tasks",
    requirePermission(PERMISSIONS.HRMS_ONBOARDING_MANAGE),
    zValidator("json", replaceOnboardingTasksSchema),
    async (c) => {
      const data = await hrmsService.replaceOnboardingTasks(
        c.var.db,
        c.req.param("id"),
        c.req.valid("json"),
      );
      return c.json({ data });
    },
  )
  .delete("/onboarding/:id", requirePermission(PERMISSIONS.HRMS_ONBOARDING_MANAGE), async (c) => {
    const data = await hrmsService.deleteOnboarding(c.var.db, c.req.param("id"));
    return c.json({ data });
  })
  .post(
    "/onboarding/:id/restore",
    requirePermission(PERMISSIONS.HRMS_ONBOARDING_MANAGE),
    async (c) => {
      const data = await hrmsService.restoreOnboarding(c.var.db, c.req.param("id"));
      return c.json({ data });
    },
  )
  // ─── Offboarding ────────────────────────────────────────
  .get(
    "/offboarding",
    requirePermission(PERMISSIONS.HRMS_READ, PERMISSIONS.HRMS_OFFBOARDING_MANAGE),
    zValidator("query", offboardingQuerySchema),
    async (c) => {
      const result = await hrmsService.listOffboarding(
        c.var.db,
        c.req.valid("query"),
        c.var.user!.id,
        c.var.user!.permissions,
      );
      return c.json(result);
    },
  )
  .post(
    "/offboarding",
    requirePermission(PERMISSIONS.HRMS_OFFBOARDING_MANAGE),
    zValidator("json", createOffboardingSchema),
    async (c) => {
      const data = await hrmsService.createOffboarding(c.var.db, c.req.valid("json"));
      return c.json({ data }, 201);
    },
  )
  .get(
    "/offboarding/template",
    requirePermission(PERMISSIONS.HRMS_READ, PERMISSIONS.HRMS_OFFBOARDING_MANAGE),
    async (c) => {
      const data = await hrmsService.getOffboardingTemplate(c.var.db);
      return c.json({ data });
    },
  )
  .put(
    "/offboarding/template",
    requirePermission(PERMISSIONS.HRMS_OFFBOARDING_MANAGE),
    zValidator("json", offboardingTemplateSchema),
    async (c) => {
      const data = await hrmsService.setOffboardingTemplate(c.var.db, c.req.valid("json"));
      return c.json({ data });
    },
  )
  .put(
    "/offboarding/:id/task",
    requirePermission(PERMISSIONS.HRMS_OFFBOARDING_MANAGE),
    zValidator("json", updateOffboardingTaskSchema),
    async (c) => {
      const data = await hrmsService.updateOffboardingTask(
        c.var.db,
        c.req.param("id"),
        c.req.valid("json"),
      );
      return c.json({ data });
    },
  )
  .put(
    "/offboarding/:id/tasks",
    requirePermission(PERMISSIONS.HRMS_OFFBOARDING_MANAGE),
    zValidator("json", replaceOffboardingTasksSchema),
    async (c) => {
      const data = await hrmsService.replaceOffboardingTasks(
        c.var.db,
        c.req.param("id"),
        c.req.valid("json"),
      );
      return c.json({ data });
    },
  )
  .put(
    "/offboarding/:id/sign",
    requirePermission(PERMISSIONS.HRMS_OFFBOARDING_MANAGE),
    zValidator("json", signOffboardingSchema),
    async (c) => {
      const data = await hrmsService.signOffboarding(
        c.var.db,
        c.req.param("id"),
        c.req.valid("json"),
      );
      return c.json({ data });
    },
  )
  .delete("/offboarding/:id", requirePermission(PERMISSIONS.HRMS_OFFBOARDING_MANAGE), async (c) => {
    const data = await hrmsService.deleteOffboarding(c.var.db, c.req.param("id"));
    return c.json({ data });
  })
  .post(
    "/offboarding/:id/restore",
    requirePermission(PERMISSIONS.HRMS_OFFBOARDING_MANAGE),
    async (c) => {
      const data = await hrmsService.restoreOffboarding(c.var.db, c.req.param("id"));
      return c.json({ data });
    },
  )
  // ─── Agreements ─────────────────────────────────────────
  .get(
    "/agreements/folders",
    requirePermission(PERMISSIONS.HRMS_AGREEMENTS_MANAGE),
    async (c) => {
      const data = await hrmsService.listAgreementFolders(c.var.db);
      return c.json({ data });
    },
  )
  .get("/agreements", requireAuth, zValidator("query", agreementQuerySchema), async (c) => {
    const result = await hrmsService.listAgreements(
      c.var.db,
      c.var.user!.id,
      c.var.user!.permissions,
      c.req.valid("query"),
    );
    return c.json(result);
  })
  .get("/agreements/:id/download", requireAuth, async (c) => {
    const id = c.req.param("id");
    const data = await hrmsService.getAgreementDownloadUrl(
      c.var.db,
      id,
      c.var.user!.id,
      c.var.user!.permissions,
    );
    return c.json({ data });
  })
  .get("/agreements/:id/file", requireAuth, async (c) => {
    const id = c.req.param("id");
    const agreement = await hrmsService.getAgreement(
      c.var.db,
      id,
      c.var.user!.id,
      c.var.user!.permissions,
    );
    const key = parseR2PrivateKey(agreement.fileUrl);
    if (key) {
      const obj = await c.env.R2_PRIVATE.get(key);
      if (!obj) throw new NotFoundException("Agreement file is not available");
      return new Response(obj.body, {
        headers: {
          "Content-Type": obj.httpMetadata?.contentType ?? "application/octet-stream",
          "Content-Disposition": `attachment; filename="agreement-${id}"`,
        },
      });
    }
    if (agreement.fileUrl?.startsWith("http")) {
      return c.redirect(agreement.fileUrl);
    }
    throw new NotFoundException("Agreement file is not available");
  })
  .get("/agreements/:id", requireAuth, async (c) => {
    const data = await hrmsService.getAgreement(
      c.var.db,
      c.req.param("id"),
      c.var.user!.id,
      c.var.user!.permissions,
    );
    return c.json({ data });
  })
  .post(
    "/agreements",
    requirePermission(PERMISSIONS.HRMS_AGREEMENTS_MANAGE),
    zValidator("json", createAgreementSchema),
    async (c) => {
      const data = await hrmsService.createAgreement(
        c.var.db,
        c.req.valid("json"),
        c.var.user!.id,
      );
      return c.json({ data }, 201);
    },
  )
  .put(
    "/agreements/:id",
    requirePermission(PERMISSIONS.HRMS_AGREEMENTS_MANAGE),
    zValidator("json", updateAgreementSchema),
    async (c) => {
      const data = await hrmsService.updateAgreement(
        c.var.db,
        c.req.param("id"),
        c.req.valid("json"),
      );
      return c.json({ data });
    },
  )
  .delete("/agreements/:id", requirePermission(PERMISSIONS.HRMS_AGREEMENTS_MANAGE), async (c) => {
    const data = await hrmsService.deleteAgreement(c.var.db, c.req.param("id"));
    return c.json({ data });
  })
  // ─── Equity monthly salary ──────────────────────────────
  .get(
    "/equity-monthly-salary",
    requirePermission(PERMISSIONS.HRMS_READ, PERMISSIONS.HRMS_ESOP_MANAGE),
    zValidator("query", equitySalaryQuerySchema),
    async (c) => {
      const query = c.req.valid("query");
      const data = await hrmsService.listEquitySalaries(
        c.var.db,
        query.year,
        c.var.user!.name,
        c.var.user!.permissions,
      );
      return c.json({ data });
    },
  )
  .post(
    "/equity-monthly-salary/import",
    requirePermission(PERMISSIONS.HRMS_ESOP_MANAGE),
    async (c) => {
      const form = await c.req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        throw new BadRequestException(
          'No file uploaded. Send multipart/form-data with field "file".',
        );
      }
      if (file.size > MULTIPART_UPLOAD_MAX_BYTES) {
        throw new BadRequestException("File exceeds maximum upload size");
      }
      const parsed = parseEquitySalaryImportBuffer(await file.arrayBuffer());
      if (parsed.rows.length === 0) {
        throw new BadRequestException(
          "No usable rows found. Make sure the sheet has an Employee Name column and at least one month value.",
        );
      }
      const result = await hrmsService.importEquitySalaries(c.var.db, parsed);
      return c.json({ data: { ...result, parseErrors: parsed.parseErrors } });
    },
  )
  .delete("/equity-monthly-salary", requirePermission(PERMISSIONS.HRMS_ESOP_MANAGE), async (c) => {
    const data = await hrmsService.deleteAllEquitySalaries(c.var.db);
    return c.json({ data });
  })
  // ─── Attendance phase 1 ─────────────────────────────────
  .post(
    "/attendance/check-in",
    requirePermission(...selfAttendancePerms),
    zValidator("json", checkInSchema),
    async (c) => {
      const data = await attendanceService.checkIn(c.var.db, c.var.user!.id, c.req.valid("json"));
      return c.json({ data }, 201);
    },
  )
  .post(
    "/attendance/check-out",
    requirePermission(...selfAttendancePerms),
    zValidator("json", checkOutSchema),
    async (c) => {
      const data = await attendanceService.checkOut(c.var.db, c.var.user!.id, c.req.valid("json"));
      return c.json({ data });
    },
  )
  .get("/attendance/today", requirePermission(...selfAttendancePerms), async (c) => {
    const data = await attendanceService.getToday(c.var.db, c.var.user!.id);
    return c.json({ data });
  })
  .get(
    "/attendance/live",
    requirePermission(PERMISSIONS.HRMS_ATTENDANCE_READ, PERMISSIONS.HRMS_ATTENDANCE_MANAGE),
    async (c) => {
      const data = await attendanceService.getLive(
        c.var.db,
        c.var.user!.id,
        c.var.user!.permissions,
      );
      return c.json({ data });
    },
  )
  .get(
    "/attendance/dashboard",
    requirePermission(PERMISSIONS.HRMS_ATTENDANCE_READ, PERMISSIONS.HRMS_ATTENDANCE_MANAGE),
    async (c) => {
      const data = await attendanceService.getDashboard(c.var.db, c.var.user!.permissions);
      return c.json({ data });
    },
  )
  .get(
    "/attendance/my-attendance",
    requirePermission(...selfAttendancePerms),
    zValidator("query", myAttendanceQuerySchema),
    async (c) => {
      const result = await attendanceService.getMyAttendance(
        c.var.db,
        c.var.user!.id,
        c.req.valid("query"),
      );
      return c.json(result);
    },
  )
  .get(
    "/attendance/report/monthly",
    requirePermission(...selfAttendancePerms),
    zValidator("query", monthlyReportQuerySchema),
    async (c) => {
      const data = await attendanceService.getMonthlyReport(
        c.var.db,
        c.var.user!.id,
        c.var.user!.permissions,
        c.req.valid("query"),
      );
      return c.json({ data });
    },
  )
  .get(
    "/attendance/report/department",
    requirePermission(PERMISSIONS.HRMS_ATTENDANCE_READ, PERMISSIONS.HRMS_ATTENDANCE_MANAGE),
    zValidator("query", departmentReportQuerySchema),
    async (c) => {
      const data = await attendanceService.getDepartmentReport(
        c.var.db,
        c.var.user!.permissions,
        c.req.valid("query"),
      );
      return c.json({ data });
    },
  )
  // ─── Attendance phase 2 ─────────────────────────────────
  .post(
    "/attendance/corrections",
    requirePermission(...selfAttendancePerms),
    zValidator("json", createCorrectionSchema),
    async (c) => {
      const data = await attendanceCorrectionService.create(
        c.var.db,
        c.var.user!.id,
        c.req.valid("json"),
      );
      return c.json({ data }, 201);
    },
  )
  .get(
    "/attendance/corrections",
    requirePermission(...selfAttendancePerms),
    zValidator("query", correctionsQuerySchema),
    async (c) => {
      const result = await attendanceCorrectionService.list(
        c.var.db,
        c.var.user!.id,
        c.var.user!.permissions,
        c.req.valid("query"),
      );
      return c.json(result);
    },
  )
  .post(
    "/attendance/corrections/:id/approve",
    requirePermission(
      PERMISSIONS.HRMS_ATTENDANCE_CORRECTION_APPROVE,
      PERMISSIONS.HRMS_ATTENDANCE_MANAGE,
    ),
    async (c) => {
      const data = await attendanceCorrectionService.approve(
        c.var.db,
        c.var.user!.id,
        c.var.user!.permissions,
        c.req.param("id"),
      );
      return c.json({ data });
    },
  )
  .post(
    "/attendance/corrections/:id/reject",
    requirePermission(
      PERMISSIONS.HRMS_ATTENDANCE_CORRECTION_APPROVE,
      PERMISSIONS.HRMS_ATTENDANCE_MANAGE,
    ),
    zValidator("json", rejectCorrectionSchema),
    async (c) => {
      const body = c.req.valid("json");
      const data = await attendanceCorrectionService.reject(
        c.var.db,
        c.var.user!.id,
        c.var.user!.permissions,
        c.req.param("id"),
        body.remarks,
      );
      return c.json({ data });
    },
  )
  .get(
    "/attendance/policy",
    requirePermission(
      PERMISSIONS.HRMS_ATTENDANCE_READ,
      PERMISSIONS.HRMS_ATTENDANCE_MANAGE,
      PERMISSIONS.HRMS_ATTENDANCE_POLICY_MANAGE,
    ),
    zValidator("query", policyQuerySchema),
    async (c) => {
      const query = c.req.valid("query");
      const data = await attendancePolicyService.getPolicy(c.var.db, query.entityId ?? null);
      return c.json({ data });
    },
  )
  .put(
    "/attendance/policy",
    requirePermission(PERMISSIONS.HRMS_ATTENDANCE_POLICY_MANAGE),
    zValidator("json", updatePolicySchema),
    async (c) => {
      const data = await attendancePolicyService.updatePolicy(c.var.db, c.req.valid("json"));
      return c.json({ data });
    },
  )
  .get(
    "/attendance/export/daily",
    requirePermission(
      PERMISSIONS.HRMS_ATTENDANCE_REPORT_EXPORT,
      PERMISSIONS.HRMS_ATTENDANCE_MANAGE,
    ),
    zValidator("query", exportQuerySchema),
    async (c) => {
      const { buffer, filename, contentType } = await attendanceExportService.exportDaily(
        c.var.db,
        c.req.valid("query"),
      );
      return new Response(buffer, {
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    },
  )
  .get(
    "/attendance/export/monthly",
    requirePermission(
      PERMISSIONS.HRMS_ATTENDANCE_REPORT_EXPORT,
      PERMISSIONS.HRMS_ATTENDANCE_MANAGE,
    ),
    zValidator("query", exportQuerySchema),
    async (c) => {
      const { buffer, filename, contentType } = await attendanceExportService.exportMonthly(
        c.var.db,
        c.req.valid("query"),
      );
      return new Response(buffer, {
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    },
  )
  .get(
    "/attendance/export/department",
    requirePermission(
      PERMISSIONS.HRMS_ATTENDANCE_REPORT_EXPORT,
      PERMISSIONS.HRMS_ATTENDANCE_MANAGE,
    ),
    zValidator("query", exportQuerySchema),
    async (c) => {
      const { buffer, filename, contentType } = await attendanceExportService.exportDepartment(
        c.var.db,
        c.req.valid("query"),
      );
      return new Response(buffer, {
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    },
  )
  .get(
    "/attendance/manager/dashboard",
    requirePermission(...selfAttendancePerms),
    async (c) => {
      const data = await attendanceManagerService.getTeamDashboard(
        c.var.db,
        c.var.user!.id,
        c.var.user!.permissions,
      );
      return c.json({ data });
    },
  )
  .get(
    "/attendance/shifts",
    requirePermission(
      PERMISSIONS.HRMS_ATTENDANCE_READ,
      PERMISSIONS.HRMS_ATTENDANCE_MANAGE,
      PERMISSIONS.HRMS_ATTENDANCE_POLICY_MANAGE,
    ),
    async (c) => {
      const entityId =
        typeof c.req.query("entityId") === "string" ? c.req.query("entityId") : undefined;
      const data = await attendanceShiftService.listShifts(c.var.db, entityId ?? null);
      return c.json({ data });
    },
  )
  .post(
    "/attendance/shifts",
    requirePermission(PERMISSIONS.HRMS_ATTENDANCE_POLICY_MANAGE),
    zValidator("json", createShiftSchema),
    async (c) => {
      const data = await attendanceShiftService.createShift(c.var.db, c.req.valid("json"));
      return c.json({ data }, 201);
    },
  )
  .put(
    "/attendance/shifts/:id",
    requirePermission(PERMISSIONS.HRMS_ATTENDANCE_POLICY_MANAGE),
    zValidator("json", updateShiftSchema),
    async (c) => {
      const data = await attendanceShiftService.updateShift(
        c.var.db,
        c.req.param("id"),
        c.req.valid("json"),
      );
      return c.json({ data });
    },
  )
  .post(
    "/attendance/shifts/assign",
    requirePermission(PERMISSIONS.HRMS_ATTENDANCE_POLICY_MANAGE),
    zValidator("json", assignShiftSchema),
    async (c) => {
      const data = await attendanceShiftService.assignShift(c.var.db, c.req.valid("json"));
      return c.json({ data }, 201);
    },
  )
  .get(
    "/attendance/exceptions",
    requirePermission(...selfAttendancePerms),
    zValidator("query", exceptionsQuerySchema),
    async (c) => {
      const result = await attendanceExceptionService.listExceptions(
        c.var.db,
        c.var.user!.id,
        c.var.user!.permissions,
        c.req.valid("query"),
      );
      return c.json(result);
    },
  )
  .post(
    "/attendance/exceptions",
    requirePermission(...selfAttendancePerms),
    zValidator("json", createExceptionSchema),
    async (c) => {
      const data = await attendanceExceptionService.createException(
        c.var.db,
        c.var.user!.id,
        c.var.user!.permissions,
        c.req.valid("json"),
      );
      return c.json({ data }, 201);
    },
  )
  .get(
    "/attendance/analytics",
    requirePermission(PERMISSIONS.HRMS_ATTENDANCE_READ, PERMISSIONS.HRMS_ATTENDANCE_MANAGE),
    zValidator("query", analyticsQuerySchema),
    async (c) => {
      const data = await attendanceAnalyticsService.getSummary(
        c.var.db,
        c.var.user!.permissions,
        c.req.valid("query"),
      );
      return c.json({ data });
    },
  )
  // ─── Attendance phase 3 ─────────────────────────────────
  .get(
    "/attendance/calendar",
    requirePermission(...selfAttendancePerms),
    zValidator("query", calendarQuerySchema),
    async (c) => {
      const data = await attendanceCalendarViewService.getCalendar(
        c.var.db,
        c.var.user!.id,
        c.var.user!.permissions,
        c.req.valid("query"),
      );
      return c.json({ data });
    },
  )
  .get(
    "/attendance/executive-analytics",
    requirePermission(PERMISSIONS.HRMS_ATTENDANCE_READ, PERMISSIONS.HRMS_ATTENDANCE_MANAGE),
    zValidator("query", executiveAnalyticsQuerySchema),
    async (c) => {
      const data = await attendanceExecutiveService.getExecutiveAnalytics(
        c.var.db,
        c.var.user!.permissions,
        c.req.valid("query"),
      );
      return c.json({ data });
    },
  )
  .get(
    "/attendance/employees/:employeeId/profile",
    requirePermission(...selfAttendancePerms),
    zValidator("query", employeeProfileQuerySchema),
    async (c) => {
      const targetId = c.req.param("employeeId");
      const canViewOthers =
        c.var.user!.permissions.includes(PERMISSIONS.HRMS_ATTENDANCE_MANAGE) ||
        c.var.user!.permissions.includes(PERMISSIONS.HRMS_ATTENDANCE_READ) ||
        targetId === c.var.user!.id;
      if (!canViewOthers) {
        throw new ForbiddenException("Cannot view this profile");
      }
      const data = await attendanceExecutiveService.getEmployeeProfileSummary(
        c.var.db,
        targetId,
        c.req.valid("query").month,
      );
      if (!data) throw new NotFoundException("Employee not found");
      return c.json({ data });
    },
  )
  .get(
    "/attendance/shift-assignments",
    requirePermission(PERMISSIONS.HRMS_ATTENDANCE_POLICY_MANAGE),
    zValidator("query", shiftAssignmentsQuerySchema),
    async (c) => {
      const query = c.req.valid("query");
      const data = await attendanceShiftService.listAssignments(c.var.db, query.entityId ?? null);
      return c.json({ data });
    },
  )
  .post(
    "/attendance/shift-assignments/bulk",
    requirePermission(PERMISSIONS.HRMS_ATTENDANCE_POLICY_MANAGE),
    zValidator("json", bulkAssignShiftSchema),
    async (c) => {
      const data = await attendanceShiftService.bulkAssign(c.var.db, c.req.valid("json"));
      return c.json({ data }, 201);
    },
  )
  .put(
    "/attendance/shift-assignments/:id",
    requirePermission(PERMISSIONS.HRMS_ATTENDANCE_POLICY_MANAGE),
    zValidator("json", changeShiftAssignmentSchema),
    async (c) => {
      const data = await attendanceShiftService.changeAssignment(
        c.var.db,
        c.req.param("id"),
        c.req.valid("json"),
      );
      return c.json({ data });
    },
  );
