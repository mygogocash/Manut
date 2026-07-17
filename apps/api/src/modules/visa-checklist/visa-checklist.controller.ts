import { Router } from "express";

import { PERMISSIONS } from "@/common/constants/permissions";
import {
  authenticate,
  requireActive,
  requirePermission,
} from "@/core/guards/auth.guard";
import { asyncHandler } from "@/core/middleware/async-handler";
import { visaChecklistService } from "@/modules/visa-checklist/visa-checklist.service";
import {
  checklistTemplateQuerySchema,
  createChecklistTemplateSchema,
  toggleChecklistItemSchema,
  updateChecklistTemplateSchema,
} from "@/modules/visa-checklist/visa-checklist.validation";

const router = Router();

// HR-desk only.
router.use(
  authenticate,
  requireActive,
  requirePermission(PERMISSIONS.VISA_MANAGE),
);

// ── Templates ─────────────────────────────────────────────

router.get(
  "/templates",
  asyncHandler(async (req, res) => {
    const query = checklistTemplateQuerySchema.parse(req.query);
    const data = await visaChecklistService.listTemplates(query);
    res.json({ data });
  }),
);

router.post(
  "/templates",
  asyncHandler(async (req, res) => {
    const input = createChecklistTemplateSchema.parse(req.body);
    const data = await visaChecklistService.createTemplate(input);
    res.status(201).json({ data });
  }),
);

router.get(
  "/templates/:id",
  asyncHandler(async (req, res) => {
    const data = await visaChecklistService.getTemplate(
      req.params.id as string,
    );
    res.json({ data });
  }),
);

router.put(
  "/templates/:id",
  asyncHandler(async (req, res) => {
    const input = updateChecklistTemplateSchema.parse(req.body);
    const data = await visaChecklistService.updateTemplate(
      req.params.id as string,
      input,
    );
    res.json({ data });
  }),
);

router.delete(
  "/templates/:id",
  asyncHandler(async (req, res) => {
    const data = await visaChecklistService.deactivateTemplate(
      req.params.id as string,
    );
    res.json({ data });
  }),
);

// ── Per-record checklist ──────────────────────────────────

router.get(
  "/record/:visaRecordId",
  asyncHandler(async (req, res) => {
    const data = await visaChecklistService.getChecklist(
      req.params.visaRecordId as string,
    );
    res.json({ data });
  }),
);

router.post(
  "/record/:visaRecordId/items/:itemId/toggle",
  asyncHandler(async (req, res) => {
    const input = toggleChecklistItemSchema.parse(req.body);
    const data = await visaChecklistService.toggleItem(
      req.params.visaRecordId as string,
      req.params.itemId as string,
      input.completed,
      req.user!.id,
    );
    res.json({ data });
  }),
);

export default router;
