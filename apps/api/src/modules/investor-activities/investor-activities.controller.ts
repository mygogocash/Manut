import { Router } from "express";

import { PERMISSIONS } from "@/common/constants/permissions";
import {
  authenticate,
  requireActive,
  requirePermission,
} from "@/core/guards/auth.guard";
import { asyncHandler } from "@/core/middleware/async-handler";
import { investorActivityService } from "@/modules/investor-activities/investor-activities.service";
import {
  createInvestorActivitySchema,
  listInvestorActivitiesSchema,
  updateInvestorActivitySchema,
} from "@/modules/investor-activities/investor-activities.validation";

const router = Router();

router.use(authenticate, requireActive);

router.get(
  "/",
  requirePermission(PERMISSIONS.INVESTORS_READ),
  asyncHandler(async (req, res) => {
    const query = listInvestorActivitiesSchema.parse(req.query);
    const result = await investorActivityService.list(
      req.user!.id,
      req.user!.permissions,
      query,
    );
    res.json(result);
  }),
);

router.post(
  "/",
  requirePermission(PERMISSIONS.INVESTORS_CREATE),
  asyncHandler(async (req, res) => {
    const input = createInvestorActivitySchema.parse(req.body);
    const data = await investorActivityService.create(
      req.user!.id,
      req.user!.permissions,
      input,
    );
    res.status(201).json({ data });
  }),
);

router.get(
  "/:id",
  requirePermission(PERMISSIONS.INVESTORS_READ),
  asyncHandler(async (req, res) => {
    const data = await investorActivityService.getById(
      req.params.id as string,
      req.user!.id,
      req.user!.permissions,
    );
    res.json({ data });
  }),
);

router.put(
  "/:id",
  requirePermission(PERMISSIONS.INVESTORS_UPDATE),
  asyncHandler(async (req, res) => {
    const input = updateInvestorActivitySchema.parse(req.body);
    const data = await investorActivityService.update(
      req.params.id as string,
      req.user!.id,
      req.user!.permissions,
      input,
    );
    res.json({ data });
  }),
);

router.delete(
  "/:id",
  requirePermission(PERMISSIONS.INVESTORS_DELETE),
  asyncHandler(async (req, res) => {
    await investorActivityService.delete(
      req.params.id as string,
      req.user!.id,
      req.user!.permissions,
    );
    res.json({ data: { success: true } });
  }),
);

export default router;
