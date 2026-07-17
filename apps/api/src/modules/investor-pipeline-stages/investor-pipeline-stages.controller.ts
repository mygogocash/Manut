import { Router } from "express";

import { PERMISSIONS } from "@/common/constants/permissions";
import {
  authenticate,
  requireActive,
  requirePermission,
} from "@/core/guards/auth.guard";
import { asyncHandler } from "@/core/middleware/async-handler";
import { investorPipelineStageService } from "@/modules/investor-pipeline-stages/investor-pipeline-stages.service";
import {
  createInvestorStageSchema,
  reorderInvestorStagesSchema,
  updateInvestorStageSchema,
} from "@/modules/investor-pipeline-stages/investor-pipeline-stages.validation";

const router = Router();

router.use(authenticate, requireActive);

router.get(
  "/",
  requirePermission(PERMISSIONS.INVESTORS_READ),
  asyncHandler(async (_req, res) => {
    const data = await investorPipelineStageService.list();
    res.json({ data });
  }),
);

router.post(
  "/",
  requirePermission(PERMISSIONS.INVESTORS_UPDATE),
  asyncHandler(async (req, res) => {
    const input = createInvestorStageSchema.parse(req.body);
    const data = await investorPipelineStageService.create(input);
    res.status(201).json({ data });
  }),
);

// Literal path before the :key param route so Express matches it first.
router.put(
  "/reorder",
  requirePermission(PERMISSIONS.INVESTORS_UPDATE),
  asyncHandler(async (req, res) => {
    const input = reorderInvestorStagesSchema.parse(req.body);
    const data = await investorPipelineStageService.reorder(input);
    res.json({ data });
  }),
);

router.put(
  "/:key",
  requirePermission(PERMISSIONS.INVESTORS_UPDATE),
  asyncHandler(async (req, res) => {
    const input = updateInvestorStageSchema.parse(req.body);
    const data = await investorPipelineStageService.update(
      req.params.key as string,
      input,
    );
    res.json({ data });
  }),
);

router.delete(
  "/:key",
  requirePermission(PERMISSIONS.INVESTORS_UPDATE),
  asyncHandler(async (req, res) => {
    const data = await investorPipelineStageService.delete(
      req.params.key as string,
    );
    res.json({ data });
  }),
);

export default router;
