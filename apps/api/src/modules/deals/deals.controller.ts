import { Router } from "express";

import { PERMISSIONS } from "@/common/constants/permissions";
import {
  authenticate,
  requireActive,
  requirePermission,
} from "@/core/guards/auth.guard";
import { asyncHandler } from "@/core/middleware/async-handler";
import { dealService } from "@/modules/deals/deals.service";
import {
  createDealSchema,
  listDealsSchema,
  updateDealSchema,
} from "@/modules/deals/deals.validation";

const router = Router();

router.use(authenticate, requireActive);

router.get(
  "/",
  requirePermission(PERMISSIONS.DEALS_READ),
  asyncHandler(async (req, res) => {
    const query = listDealsSchema.parse(req.query);
    const result = await dealService.list(
      req.user!.id,
      req.user!.permissions,
      query,
    );
    res.json(result);
  }),
);

router.get(
  "/pipeline",
  requirePermission(PERMISSIONS.DEALS_READ),
  asyncHandler(async (req, res) => {
    const data = await dealService.getPipelineSummary(
      req.user!.id,
      req.user!.permissions,
    );
    res.json({ data });
  }),
);

router.post(
  "/",
  requirePermission(PERMISSIONS.DEALS_CREATE),
  asyncHandler(async (req, res) => {
    const input = createDealSchema.parse(req.body);
    const data = await dealService.create(req.user!.id, input);
    res.status(201).json({ data });
  }),
);

router.get(
  "/:id",
  requirePermission(PERMISSIONS.DEALS_READ),
  asyncHandler(async (req, res) => {
    const data = await dealService.getById(
      req.params.id as string,
      req.user!.id,
      req.user!.permissions,
    );
    res.json({ data });
  }),
);

router.put(
  "/:id",
  requirePermission(PERMISSIONS.DEALS_UPDATE),
  asyncHandler(async (req, res) => {
    const input = updateDealSchema.parse(req.body);
    const data = await dealService.update(
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
  requirePermission(PERMISSIONS.DEALS_DELETE),
  asyncHandler(async (req, res) => {
    await dealService.delete(
      req.params.id as string,
      req.user!.id,
      req.user!.permissions,
    );
    res.json({ data: { success: true } });
  }),
);

export default router;
