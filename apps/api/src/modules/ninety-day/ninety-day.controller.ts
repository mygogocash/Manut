import { Router } from "express";

import { PERMISSIONS } from "@/common/constants/permissions";
import {
  authenticate,
  requireActive,
  requirePermission,
} from "@/core/guards/auth.guard";
import { asyncHandler } from "@/core/middleware/async-handler";
import { ninetyDayService } from "@/modules/ninety-day/ninety-day.service";
import {
  createNinetyDaySchema,
  ninetyDayQuerySchema,
  updateNinetyDaySchema,
} from "@/modules/ninety-day/ninety-day.validation";

const router = Router();

router.use(authenticate, requireActive);

router.get(
  "/",
  requirePermission(PERMISSIONS.VISA_HR_READ, PERMISSIONS.VISA_MANAGE),
  asyncHandler(async (req, res) => {
    const query = ninetyDayQuerySchema.parse(req.query);
    const result = await ninetyDayService.list(query);
    res.json(result);
  }),
);

router.post(
  "/",
  requirePermission(PERMISSIONS.VISA_MANAGE),
  asyncHandler(async (req, res) => {
    const input = createNinetyDaySchema.parse(req.body);
    const data = await ninetyDayService.create(input, req.user!.id);
    res.status(201).json({ data });
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
    const result = await ninetyDayService.previewImport(rows);
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
    const result = await ninetyDayService.commitImport(rows);
    res.json({ data: result });
  }),
);

router.get(
  "/:id/receipt/download",
  requirePermission(PERMISSIONS.VISA_HR_READ, PERMISSIONS.VISA_MANAGE),
  asyncHandler(async (req, res) => {
    const data = await ninetyDayService.getReceiptDownloadUrl(
      req.params.id as string,
    );
    res.json({ data });
  }),
);

router.get(
  "/:id",
  requirePermission(PERMISSIONS.VISA_HR_READ, PERMISSIONS.VISA_MANAGE),
  asyncHandler(async (req, res) => {
    const data = await ninetyDayService.getById(req.params.id as string);
    res.json({ data });
  }),
);

router.put(
  "/:id",
  requirePermission(PERMISSIONS.VISA_MANAGE),
  asyncHandler(async (req, res) => {
    const input = updateNinetyDaySchema.parse(req.body);
    const data = await ninetyDayService.update(
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
    const data = await ninetyDayService.delete(req.params.id as string);
    res.json({ data });
  }),
);

export default router;
