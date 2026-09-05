import { Router } from "express";
import multer from "multer";
import * as XLSX from "xlsx";

import { PERMISSIONS } from "@/common/constants/permissions";
import { logger } from "@/common/utils/logger";
import {
  authenticate,
  ensurePermissionsLoaded,
  requireActive,
  requirePermission,
} from "@/core/guards/auth.guard";
import { asyncHandler } from "@/core/middleware/async-handler";
import { logAudit } from "@/infrastructure/audit/audit.service";
import {
  EQUITY_MONTHLY_SHEET_HINT,
  parseEquitySalaryWorkbook,
} from "@/modules/hrms/equity-salary-import";
import {
  detectEsopTemplateVersion,
  ESOP_IMPORT_SHEET,
  ESOP_IMPORT_SHEET_V1,
  type ParsedRow,
  parseV1Workbook,
  parseWorkbookRow,
} from "@/modules/hrms/esop-import";
import { hrmsService } from "@/modules/hrms/hrms.service";
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
} from "@/modules/hrms/hrms.validation";

const router = Router();

router.use(authenticate, requireActive);

const esopUpload = multer({
  storage: multer.memoryStorage(),
  // 10 MB cap covers the HR template (current file is ~130 KB) with
  // plenty of headroom for future history sheets.
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.get(
  "/esop-pool",
  // Pool summary aggregates total option allocation across the company —
  // sensitive C-level data, gated to `hrms:esop-manage` only. Plain
  // employees with `hrms:read` see their own grants via `/esop-grants`
  // but never the company-wide totals.
  requirePermission(PERMISSIONS.HRMS_ESOP_MANAGE),
  asyncHandler(async (_req, res) => {
    const data = await hrmsService.getEsopPool();
    res.json({ data });
  }),
);

router.get(
  "/esop-grants",
  requirePermission(PERMISSIONS.HRMS_READ, PERMISSIONS.HRMS_ESOP_MANAGE),
  asyncHandler(async (req, res) => {
    const query = esopGrantQuerySchema.parse(req.query);
    // Service forces ownership scope when the caller lacks
    // `hrms:esop-manage`, so plain employees only ever see their own
    // grants no matter what `employeeId` they send.
    const result = await hrmsService.listGrants(
      query,
      req.user!.id,
      req.user!.permissions,
    );
    res.json(result);
  }),
);

router.post(
  "/esop-grants",
  requirePermission(PERMISSIONS.HRMS_ESOP_MANAGE),
  asyncHandler(async (req, res) => {
    const input = createEsopGrantSchema.parse(req.body);
    const data = await hrmsService.createGrant(input);
    res.status(201).json({ data });
  }),
);

// Per-employee ESOP breakdown. Literal segment "by-employee" must precede
// the "/esop-grants/:id" routes below — Express matches in order.
router.get(
  "/esop-grants/by-employee/:employeeId",
  requirePermission(PERMISSIONS.HRMS_ESOP_MANAGE),
  asyncHandler(async (req, res) => {
    const data = await hrmsService.getEsopEmployeeSummary(
      req.params.employeeId as string,
    );
    res.json({ data });
  }),
);

// ─── ESOP bulk import (XLSX / CSV) ───────────────────────
//
// Literal paths must come before /esop-grants/:id — Express matches in
// declaration order.

router.get(
  "/esop-grants/import-template",
  requirePermission(PERMISSIONS.HRMS_ESOP_MANAGE),
  asyncHandler(async (req, res) => {
    // V1 long-format template. The 2-row assumptions band is
    // copied so the layout matches HR's "Equity Summary Report
    // (Revised)" workbook exactly — the parser keys off the
    // header row "Name of Staff | Equity Type | ..." at row 4.
    const headerRow = [
      "Name of Staff",
      "Equity Type",
      "Equity in USD",
      "Equity in THB",
      "No. of Shares",
      "Lock Period",
      "Vesting Period",
      "Increasing Period",
      "Source / Notes",
    ];
    const equityTypes = [
      "Equity from Contract",
      "Sign-up Equity",
      "CXO Equity",
      "Equity from 2024 Bonus",
      "Golden Handcuff",
    ];
    const personBlock = (
      name: string,
      position: string,
      header: string,
      rows: Array<Partial<Record<(typeof headerRow)[number], string | number>>>,
    ): unknown[][] => {
      const block: unknown[][] = [
        [`${name}  —  ${position}${header ? `   |   ${header}` : ""}`],
      ];
      for (const type of equityTypes) {
        const r = rows.find((x) => x["Equity Type"] === type) ?? {
          "Equity Type": type,
        };
        block.push([
          name,
          r["Equity Type"] ?? type,
          r["Equity in USD"] ?? "",
          r["Equity in THB"] ?? "",
          r["No. of Shares"] ?? "",
          r["Lock Period"] ?? "",
          r["Vesting Period"] ?? "",
          r["Increasing Period"] ?? "",
          r["Source / Notes"] ?? "",
        ]);
      }
      block.push([`Total — ${name}`]);
      block.push([]);
      return block;
    };

    const aoa: unknown[][] = [
      ["Binary Holdings — Equity Summary Report (Revised)"],
      [
        "Assumptions:",
        "USD/THB FX Rate",
        36.5,
        "Share Price (USD)",
        1,
        "Report Date",
        "",
        "Source",
        "Employment Contracts + Annual Review",
      ],
      [],
      headerRow,
      ["CEO Office"],
      ...personBlock(
        "Jane Doe",
        "Chief Example Officer",
        "BNRY Tokens (Contract): THB 280,000   |   Shark Tank Bonus: 50,000 Tokens",
        [
          {
            "Equity Type": "Equity from Contract",
            "Equity in THB": "280000/month",
          },
          { "Equity Type": "Sign-up Equity", "Equity in USD": 500000 },
          { "Equity Type": "CXO Equity", "No. of Shares": 50000 },
          { "Equity Type": "Golden Handcuff", "No. of Shares": 20000 },
        ],
      ),
      ["Marketing Team"],
      ...personBlock(
        "John Smith",
        "Digital Marketing Manager",
        "BNRY Tokens (Contract): N/A",
        [{ "Equity Type": "Golden Handcuff", "No. of Shares": 1000 }],
      ),
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    XLSX.utils.book_append_sheet(wb, ws, ESOP_IMPORT_SHEET_V1);

    const format = (req.query.format as string) ?? "xlsx";
    if (format === "csv") {
      const csv = XLSX.utils.sheet_to_csv(ws);
      res
        .header(
          "Content-Disposition",
          'attachment; filename="esop-grants-import-template.csv"',
        )
        .header("Content-Type", "text/csv; charset=utf-8")
        .send(csv);
      return;
    }

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    res
      .header(
        "Content-Disposition",
        'attachment; filename="esop-grants-import-template.xlsx"',
      )
      .header(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      )
      .send(buf);
  }),
);

router.post(
  "/esop-grants/bulk-import",
  requirePermission(PERMISSIONS.HRMS_ESOP_MANAGE),
  esopUpload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      res.status(400).json({
        error: 'No file uploaded. Send multipart/form-data with field "file".',
      });
      return;
    }

    const wb = XLSX.read(req.file.buffer, { type: "buffer" });
    if (wb.SheetNames.length === 0) {
      res.status(400).json({ error: "Workbook has no sheets" });
      return;
    }
    const firstSheetAoa = XLSX.utils.sheet_to_json<unknown[]>(
      wb.Sheets[wb.SheetNames[0]!]!,
      { header: 1, defval: "", raw: true },
    );
    const version = detectEsopTemplateVersion(wb.SheetNames, firstSheetAoa);

    const parsedRows: ParsedRow[] = [];
    const parseErrors: { rowNumber: number; errors: string[] }[] = [];

    if (version === "v1") {
      const sheetName =
        wb.SheetNames.find((n) => n === ESOP_IMPORT_SHEET_V1) ??
        wb.SheetNames[0]!;
      const aoa = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName]!, {
        header: 1,
        defval: "",
        raw: true,
      });
      const result = parseV1Workbook(aoa);
      parsedRows.push(...result.rows);
      parseErrors.push(...result.parseErrors);
    } else {
      const sheetName =
        wb.SheetNames.find((n) => n === ESOP_IMPORT_SHEET) ?? wb.SheetNames[0]!;
      const sheet = wb.Sheets[sheetName]!;
      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: "",
        raw: false,
      });
      rawRows.forEach((raw, idx) => {
        const rowNumber = idx + 2; // header is row 1
        const parsed = parseWorkbookRow(raw, rowNumber);
        if (!parsed) return;
        if (parsed.cellErrors.length > 0) {
          parseErrors.push({ rowNumber, errors: parsed.cellErrors });
        }
        parsedRows.push(parsed.row);
      });
    }

    if (parsedRows.length === 0) {
      res.status(400).json({
        error:
          "No usable rows found. Make sure the sheet has a Name column and at least one grant cell.",
      });
      return;
    }

    const replace = String(req.body?.replace ?? "false") === "true";
    const result = await hrmsService.bulkImportGrants(parsedRows, {
      replace,
    });

    logger.info(
      `ESOP bulk-import: ${result.importedRows} rows ok, ${result.totalGrants} grants by ${req.user!.email}`,
    );
    void logAudit({
      action: "bulk_import",
      resource: "esop_grant",
      details: {
        importedRows: result.importedRows,
        skippedRows: result.skippedRows,
        failedRows: result.failedRows,
        totalGrants: result.totalGrants,
        replace,
      },
      req,
    });

    res.json({ data: { ...result, parseErrors } });
  }),
);

// Literal /bulk-delete must come before /:id — Express matches in
// declaration order.
router.post(
  "/esop-grants/bulk-delete",
  requirePermission(PERMISSIONS.HRMS_ESOP_MANAGE),
  asyncHandler(async (req, res) => {
    const input = bulkDeleteEsopGrantsSchema.parse(req.body);
    const data = await hrmsService.bulkDeleteGrants(input);
    void logAudit({
      action: "bulk_delete",
      resource: "esop_grant",
      details: {
        mode: data.mode,
        deletedCount: data.deletedCount,
        requestedIds: input.ids?.length ?? 0,
        deleteAll: input.all === true,
      },
      req,
    });
    logger.info(
      `ESOP bulk-delete: mode=${data.mode}, deleted=${data.deletedCount} by ${req.user!.email}`,
    );
    res.json({ data });
  }),
);

router.put(
  "/esop-grants/:id",
  requirePermission(PERMISSIONS.HRMS_ESOP_MANAGE),
  asyncHandler(async (req, res) => {
    const input = updateEsopGrantSchema.parse(req.body);
    const data = await hrmsService.updateGrant(req.params.id as string, input);
    res.json({ data });
  }),
);

router.delete(
  "/esop-grants/:id",
  requirePermission(PERMISSIONS.HRMS_ESOP_MANAGE),
  asyncHandler(async (req, res) => {
    await hrmsService.deleteGrant(req.params.id as string);
    res.json({ data: { success: true } });
  }),
);

router.get(
  "/onboarding",
  requirePermission(PERMISSIONS.HRMS_READ, PERMISSIONS.HRMS_ONBOARDING_MANAGE),
  asyncHandler(async (req, res) => {
    const query = onboardingQuerySchema.parse(req.query);
    const result = await hrmsService.listOnboarding(
      query,
      req.user!.id,
      req.user!.permissions,
    );
    res.json(result);
  }),
);

router.post(
  "/onboarding",
  requirePermission(PERMISSIONS.HRMS_ONBOARDING_MANAGE),
  asyncHandler(async (req, res) => {
    const input = createOnboardingSchema.parse(req.body);
    const data = await hrmsService.createOnboarding(input);
    res.status(201).json({ data });
  }),
);

// Admin-managed default template (parts + tasks). Literal `/template`
// registers before any `/onboarding/:id` param route.
router.get(
  "/onboarding/template",
  requirePermission(PERMISSIONS.HRMS_READ, PERMISSIONS.HRMS_ONBOARDING_MANAGE),
  asyncHandler(async (_req, res) => {
    const data = await hrmsService.getOnboardingTemplate();
    res.json({ data });
  }),
);

router.put(
  "/onboarding/template",
  requirePermission(PERMISSIONS.HRMS_ONBOARDING_MANAGE),
  asyncHandler(async (req, res) => {
    const input = onboardingTemplateSchema.parse(req.body);
    const data = await hrmsService.setOnboardingTemplate(input);
    res.json({ data });
  }),
);

router.put(
  "/onboarding/:id/task",
  requirePermission(PERMISSIONS.HRMS_ONBOARDING_MANAGE),
  asyncHandler(async (req, res) => {
    const input = updateOnboardingTaskSchema.parse(req.body);
    const data = await hrmsService.updateOnboardingTask(
      req.params.id as string,
      input,
    );
    res.json({ data });
  }),
);

// Bulk replace — HR rewrites the entire task list in one go.
router.put(
  "/onboarding/:id/tasks",
  requirePermission(PERMISSIONS.HRMS_ONBOARDING_MANAGE),
  asyncHandler(async (req, res) => {
    const input = replaceOnboardingTasksSchema.parse(req.body);
    const data = await hrmsService.replaceOnboardingTasks(
      req.params.id as string,
      input,
    );
    res.json({ data });
  }),
);

// Soft delete (duplicate cleanup) + restore. HR/admin only.
router.delete(
  "/onboarding/:id",
  requirePermission(PERMISSIONS.HRMS_ONBOARDING_MANAGE),
  asyncHandler(async (req, res) => {
    const data = await hrmsService.deleteOnboarding(req.params.id as string);
    res.json({ data });
  }),
);

router.post(
  "/onboarding/:id/restore",
  requirePermission(PERMISSIONS.HRMS_ONBOARDING_MANAGE),
  asyncHandler(async (req, res) => {
    const data = await hrmsService.restoreOnboarding(req.params.id as string);
    res.json({ data });
  }),
);

// ── Offboarding (exit checklist) ─────────────────────────────────────────

router.get(
  "/offboarding",
  requirePermission(PERMISSIONS.HRMS_READ, PERMISSIONS.HRMS_OFFBOARDING_MANAGE),
  asyncHandler(async (req, res) => {
    const query = offboardingQuerySchema.parse(req.query);
    const result = await hrmsService.listOffboarding(
      query,
      req.user!.id,
      req.user!.permissions,
    );
    res.json(result);
  }),
);

router.post(
  "/offboarding",
  requirePermission(PERMISSIONS.HRMS_OFFBOARDING_MANAGE),
  asyncHandler(async (req, res) => {
    const input = createOffboardingSchema.parse(req.body);
    const data = await hrmsService.createOffboarding(input);
    res.status(201).json({ data });
  }),
);

// Admin-managed default template (parts + tasks). Literal `/template`
// registers before any `/offboarding/:id` param route.
router.get(
  "/offboarding/template",
  requirePermission(PERMISSIONS.HRMS_READ, PERMISSIONS.HRMS_OFFBOARDING_MANAGE),
  asyncHandler(async (_req, res) => {
    const data = await hrmsService.getOffboardingTemplate();
    res.json({ data });
  }),
);

router.put(
  "/offboarding/template",
  requirePermission(PERMISSIONS.HRMS_OFFBOARDING_MANAGE),
  asyncHandler(async (req, res) => {
    const input = offboardingTemplateSchema.parse(req.body);
    const data = await hrmsService.setOffboardingTemplate(input);
    res.json({ data });
  }),
);

router.put(
  "/offboarding/:id/task",
  requirePermission(PERMISSIONS.HRMS_OFFBOARDING_MANAGE),
  asyncHandler(async (req, res) => {
    const input = updateOffboardingTaskSchema.parse(req.body);
    const data = await hrmsService.updateOffboardingTask(
      req.params.id as string,
      input,
    );
    res.json({ data });
  }),
);

// Bulk replace — HR rewrites the entire task list in one go.
router.put(
  "/offboarding/:id/tasks",
  requirePermission(PERMISSIONS.HRMS_OFFBOARDING_MANAGE),
  asyncHandler(async (req, res) => {
    const input = replaceOffboardingTasksSchema.parse(req.body);
    const data = await hrmsService.replaceOffboardingTasks(
      req.params.id as string,
      input,
    );
    res.json({ data });
  }),
);

// Record an employee / HR sign-off on the exit checklist.
router.put(
  "/offboarding/:id/sign",
  requirePermission(PERMISSIONS.HRMS_OFFBOARDING_MANAGE),
  asyncHandler(async (req, res) => {
    const input = signOffboardingSchema.parse(req.body);
    const data = await hrmsService.signOffboarding(
      req.params.id as string,
      input,
    );
    res.json({ data });
  }),
);

// Soft delete (duplicate cleanup) + restore. HR/admin only.
router.delete(
  "/offboarding/:id",
  requirePermission(PERMISSIONS.HRMS_OFFBOARDING_MANAGE),
  asyncHandler(async (req, res) => {
    const data = await hrmsService.deleteOffboarding(req.params.id as string);
    res.json({ data });
  }),
);

router.post(
  "/offboarding/:id/restore",
  requirePermission(PERMISSIONS.HRMS_OFFBOARDING_MANAGE),
  asyncHandler(async (req, res) => {
    const data = await hrmsService.restoreOffboarding(req.params.id as string);
    res.json({ data });
  }),
);

// ── Employee agreements ─────────────────────────────────────────────────

// Literal /agreements/folders must come before /agreements/:id.
router.get(
  "/agreements/folders",
  requirePermission(PERMISSIONS.HRMS_AGREEMENTS_MANAGE),
  asyncHandler(async (_req, res) => {
    const data = await hrmsService.listAgreementFolders();
    res.json({ data });
  }),
);

// Authenticated employee can read their own agreements; HR/admin reads
// any. Permissions are resolved inside the service, so we must populate
// them up-front — the route has no `requirePermission` gate that would
// have done it for us, and without this call the service treats every
// caller as a plain employee and silently scopes the result to their
// own files.
router.get(
  "/agreements",
  asyncHandler(async (req, res) => {
    await ensurePermissionsLoaded(req);
    const query = agreementQuerySchema.parse(req.query);
    const result = await hrmsService.listAgreements(
      req.user!.id,
      req.user!.permissions,
      query,
    );
    res.json(result);
  }),
);

// Mint a short-lived signed URL for the agreement file. Literal segment
// must come before /agreements/:id.
router.get(
  "/agreements/:id/download",
  asyncHandler(async (req, res) => {
    await ensurePermissionsLoaded(req);
    const data = await hrmsService.getAgreementDownloadUrl(
      req.params.id as string,
      req.user!.id,
      req.user!.permissions,
    );
    res.json({ data });
  }),
);

router.get(
  "/agreements/:id",
  asyncHandler(async (req, res) => {
    await ensurePermissionsLoaded(req);
    const data = await hrmsService.getAgreement(
      req.params.id as string,
      req.user!.id,
      req.user!.permissions,
    );
    res.json({ data });
  }),
);

router.post(
  "/agreements",
  requirePermission(PERMISSIONS.HRMS_AGREEMENTS_MANAGE),
  asyncHandler(async (req, res) => {
    const input = createAgreementSchema.parse(req.body);
    const data = await hrmsService.createAgreement(input, req.user!.id);
    res.status(201).json({ data });
  }),
);

router.put(
  "/agreements/:id",
  requirePermission(PERMISSIONS.HRMS_AGREEMENTS_MANAGE),
  asyncHandler(async (req, res) => {
    const input = updateAgreementSchema.parse(req.body);
    const data = await hrmsService.updateAgreement(
      req.params.id as string,
      input,
    );
    res.json({ data });
  }),
);

router.delete(
  "/agreements/:id",
  requirePermission(PERMISSIONS.HRMS_AGREEMENTS_MANAGE),
  asyncHandler(async (req, res) => {
    const data = await hrmsService.deleteAgreement(req.params.id as string);
    res.json({ data });
  }),
);

// ─── Equity Monthly Salary ─────────────────────────────────
//
// Reuses the ESOP perms (`hrms:esop-read` / `hrms:esop-manage`) since
// it's the same domain and audience. List is open to anyone with read
// access; import + delete-all require manage.

router.get(
  "/equity-monthly-salary",
  requirePermission(PERMISSIONS.HRMS_READ, PERMISSIONS.HRMS_ESOP_MANAGE),
  asyncHandler(async (req, res) => {
    const query = equitySalaryQuerySchema.parse(req.query);
    const data = await hrmsService.listEquitySalaries(
      query.year,
      req.user!.name,
      req.user!.permissions,
    );
    res.json({ data });
  }),
);

router.post(
  "/equity-monthly-salary/import",
  requirePermission(PERMISSIONS.HRMS_ESOP_MANAGE),
  esopUpload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      res.status(400).json({
        error: 'No file uploaded. Send multipart/form-data with field "file".',
      });
      return;
    }
    const wb = XLSX.read(req.file.buffer, { type: "buffer" });
    if (wb.SheetNames.length === 0) {
      res.status(400).json({ error: "Workbook has no sheets" });
      return;
    }
    // Prefer the sheet whose name contains "Monthly Salary"; fall
    // back to the first sheet so imports don't break if HR renames.
    const sheetName =
      wb.SheetNames.find((n) =>
        n.toLowerCase().includes(EQUITY_MONTHLY_SHEET_HINT.toLowerCase()),
      ) ?? wb.SheetNames[0]!;
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName]!, {
      header: 1,
      defval: "",
      raw: true,
    });
    const parsed = parseEquitySalaryWorkbook(aoa);
    if (parsed.rows.length === 0) {
      res.status(400).json({
        error:
          "No usable rows found. Make sure the sheet has an Employee Name column and at least one month value.",
      });
      return;
    }
    const result = await hrmsService.importEquitySalaries(parsed);

    logger.info(
      `Equity monthly salary import: ${result.importedRows} rows for year ${result.year} by ${req.user!.email}`,
    );
    void logAudit({
      action: "bulk_import",
      resource: "equity_monthly_salary",
      details: {
        year: result.year,
        importedRows: result.importedRows,
        parseErrors: parsed.parseErrors.length,
      },
      req,
    });
    res.json({ data: { ...result, parseErrors: parsed.parseErrors } });
  }),
);

router.delete(
  "/equity-monthly-salary",
  requirePermission(PERMISSIONS.HRMS_ESOP_MANAGE),
  asyncHandler(async (req, res) => {
    const data = await hrmsService.deleteAllEquitySalaries();
    logger.info(
      `Equity monthly salary delete-all: ${data.deletedCount} rows by ${req.user!.email}`,
    );
    void logAudit({
      action: "delete_all",
      resource: "equity_monthly_salary",
      details: { deletedCount: data.deletedCount },
      req,
    });
    res.json({ data });
  }),
);

export default router;
