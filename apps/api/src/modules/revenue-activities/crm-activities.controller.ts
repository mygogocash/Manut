import { Router } from "express";

import { PERMISSIONS } from "@/common/constants/permissions";
import {
  authenticate,
  requireActive,
  requirePermission,
} from "@/core/guards/auth.guard";
import { asyncHandler } from "@/core/middleware/async-handler";
import { crmActivityService } from "@/modules/revenue-activities/crm-activities.service";
import {
  createCrmActivitySchema,
  listCrmActivitiesSchema,
  updateCrmActivitySchema,
} from "@/modules/revenue-activities/crm-activities.validation";

const router = Router();

router.use(authenticate, requireActive);

router.get(
  "/",
  requirePermission(PERMISSIONS.SALES_REVENUE_READ),
  asyncHandler(async (req, res) => {
    const query = listCrmActivitiesSchema.parse(req.query);
    const result = await crmActivityService.list(
      req.user!.id,
      req.user!.permissions,
      query,
    );
    res.json(result);
  }),
);

router.post(
  "/",
  requirePermission(PERMISSIONS.SALES_REVENUE_CREATE),
  asyncHandler(async (req, res) => {
    const input = createCrmActivitySchema.parse(req.body);
    const data = await crmActivityService.create(req.user!.id, input);
    res.status(201).json({ data });
  }),
);

router.get(
  "/:id",
  requirePermission(PERMISSIONS.SALES_REVENUE_READ),
  asyncHandler(async (req, res) => {
    const data = await crmActivityService.getById(
      req.params.id as string,
      req.user!.id,
      req.user!.permissions,
    );
    res.json({ data });
  }),
);

router.put(
  "/:id",
  requirePermission(PERMISSIONS.SALES_REVENUE_UPDATE),
  asyncHandler(async (req, res) => {
    const input = updateCrmActivitySchema.parse(req.body);
    const data = await crmActivityService.update(
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
  requirePermission(PERMISSIONS.SALES_REVENUE_DELETE),
  asyncHandler(async (req, res) => {
    await crmActivityService.delete(
      req.params.id as string,
      req.user!.id,
      req.user!.permissions,
    );
    res.json({ data: { success: true } });
  }),
);

export default router;
