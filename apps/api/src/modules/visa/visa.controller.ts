import { Router } from "express";

import { PERMISSIONS } from "@/common/constants/permissions";
import {
  authenticate,
  requireActive,
  requirePermission,
} from "@/core/guards/auth.guard";
import { asyncHandler } from "@/core/middleware/async-handler";
import { visaService } from "@/modules/visa/visa.service";
import {
  createVisaSchema,
  parseScanSchema,
  updateVisaSchema,
  visaQuerySchema,
} from "@/modules/visa/visa.validation";

const router = Router();

router.use(authenticate, requireActive);

router.get(
  "/",
  requirePermission(
    PERMISSIONS.VISA_READ,
    PERMISSIONS.VISA_HR_READ,
    PERMISSIONS.VISA_MANAGE,
  ),
  asyncHandler(async (req, res) => {
    const query = visaQuerySchema.parse(req.query);
    const result = await visaService.list(
      req.user!.id,
      req.user!.permissions,
      query,
    );
    res.json(result);
  }),
);

router.post(
  "/",
  requirePermission(PERMISSIONS.VISA_MANAGE),
  asyncHandler(async (req, res) => {
    const input = createVisaSchema.parse(req.body);
    const data = await visaService.create(input, req.user!.id);
    res.status(201).json({ data });
  }),
);

// Mint a short-lived signed URL for one of the visa's stored documents.
// Literal path must come BEFORE `/:id` so Express doesn't gobble it
// (CLAUDE.md: bitten twice already). The bucket is private (#292) so
// the FE cannot link the stored URL directly.
router.get(
  "/:id/download",
  requirePermission(
    PERMISSIONS.VISA_READ,
    PERMISSIONS.VISA_HR_READ,
    PERMISSIONS.VISA_MANAGE,
  ),
  asyncHandler(async (req, res) => {
    const rawIndex = req.query.docIndex;
    const docIndex =
      typeof rawIndex === "string" && rawIndex.length > 0
        ? Number(rawIndex)
        : undefined;
    if (
      docIndex !== undefined &&
      (!Number.isInteger(docIndex) || docIndex < 0)
    ) {
      res.status(400).json({
        error: {
          code: "INVALID_INPUT",
          message: "docIndex must be a non-negative integer",
        },
      });
      return;
    }
    const data = await visaService.getDocumentDownloadUrl(
      req.params.id as string,
      req.user!.id,
      req.user!.permissions,
      docIndex,
    );
    res.json({ data });
  }),
);

// OCR autofill — extract structured fields from an uploaded visa/passport
// scan. Literal path before "/:id". HR-desk only (visa:manage).
router.post(
  "/parse-scan",
  requirePermission(PERMISSIONS.VISA_MANAGE),
  asyncHandler(async (req, res) => {
    const input = parseScanSchema.parse(req.body);
    const data = await visaService.parseDocumentScan(input);
    res.json({ data });
  }),
);

// Admin-configurable expiry-reminder config. Literal paths must come
// before "/:id" so Express doesn't treat them as record ids.
router.get(
  "/notification-config",
  requirePermission(PERMISSIONS.VISA_MANAGE),
  asyncHandler(async (_req, res) => {
    const data = await visaService.getNotificationConfig();
    res.json({ data });
  }),
);

router.put(
  "/notification-config/recipients",
  requirePermission(PERMISSIONS.VISA_MANAGE),
  asyncHandler(async (req, res) => {
    const body = req.body as { emails?: unknown };
    const emails = Array.isArray(body.emails)
      ? (body.emails as unknown[]).filter(
          (v): v is string => typeof v === "string",
        )
      : [];
    const data = await visaService.setNotificationRecipients(emails);
    res.json({ data });
  }),
);

router.put(
  "/notification-config/lead-days",
  requirePermission(PERMISSIONS.VISA_MANAGE),
  asyncHandler(async (req, res) => {
    const body = req.body as { leadDays?: unknown };
    const raw = Array.isArray(body.leadDays) ? body.leadDays : [];
    const data = await visaService.setNotificationLeadDays(raw);
    res.json({ data });
  }),
);

router.put(
  "/notification-config/notify-employee",
  requirePermission(PERMISSIONS.VISA_MANAGE),
  asyncHandler(async (req, res) => {
    const body = req.body as { notifyEmployee?: unknown };
    const data = await visaService.setNotificationNotifyEmployee(
      body.notifyEmployee,
    );
    res.json({ data });
  }),
);

// Per-record activity timeline. Literal segment must come before "/:id".
// HR-desk only (visa:manage).
router.get(
  "/:id/timeline",
  requirePermission(PERMISSIONS.VISA_MANAGE),
  asyncHandler(async (req, res) => {
    const data = await visaService.getTimeline(req.params.id as string);
    res.json({ data });
  }),
);

router.get(
  "/:id",
  requirePermission(
    PERMISSIONS.VISA_READ,
    PERMISSIONS.VISA_HR_READ,
    PERMISSIONS.VISA_MANAGE,
  ),
  asyncHandler(async (req, res) => {
    const data = await visaService.getById(
      req.params.id as string,
      req.user!.id,
      req.user!.permissions,
    );
    res.json({ data });
  }),
);

router.put(
  "/:id",
  requirePermission(PERMISSIONS.VISA_MANAGE),
  asyncHandler(async (req, res) => {
    const input = updateVisaSchema.parse(req.body);
    const data = await visaService.update(
      req.params.id as string,
      input,
      req.user!.id,
    );
    res.json({ data });
  }),
);

router.delete(
  "/:id",
  requirePermission(PERMISSIONS.VISA_MANAGE),
  asyncHandler(async (req, res) => {
    await visaService.delete(req.params.id as string);
    res.json({ data: { success: true } });
  }),
);

router.post(
  "/:id/restore",
  requirePermission(PERMISSIONS.VISA_MANAGE),
  asyncHandler(async (req, res) => {
    const data = await visaService.restore(req.params.id as string);
    res.json({ data });
  }),
);

router.delete(
  "/:id/permanent",
  requirePermission(PERMISSIONS.VISA_MANAGE),
  asyncHandler(async (req, res) => {
    const data = await visaService.permanentDelete(req.params.id as string);
    res.json({ data });
  }),
);

router.post(
  "/import/preview",
  requirePermission(PERMISSIONS.VISA_MANAGE),
  asyncHandler(async (req, res) => {
    const { rows } = req.body as { rows: Array<Record<string, unknown>> };
    if (!Array.isArray(rows) || rows.length === 0) {
      res.status(400).json({
        error: { code: "INVALID_INPUT", message: "rows array is required" },
      });
      return;
    }
    const result = await visaService.previewImport(rows);
    res.json({ data: result });
  }),
);

router.post(
  "/import/commit",
  requirePermission(PERMISSIONS.VISA_MANAGE),
  asyncHandler(async (req, res) => {
    const { rows } = req.body as { rows: Array<Record<string, unknown>> };
    if (!Array.isArray(rows) || rows.length === 0) {
      res.status(400).json({
        error: { code: "INVALID_INPUT", message: "rows array is required" },
      });
      return;
    }
    const result = await visaService.commitImport(rows);
    res.json({ data: result });
  }),
);

export default router;
