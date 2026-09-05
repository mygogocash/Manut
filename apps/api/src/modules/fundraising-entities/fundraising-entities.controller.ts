import { Router } from "express";

import { PERMISSIONS } from "@/common/constants/permissions";
import {
  authenticate,
  requireActive,
  requirePermission,
} from "@/core/guards/auth.guard";
import { asyncHandler } from "@/core/middleware/async-handler";
import { fundraisingEntityService } from "@/modules/fundraising-entities/fundraising-entities.service";
import {
  createFundraisingEntitySchema,
  reorderFundraisingEntitiesSchema,
  updateFundraisingEntitySchema,
} from "@/modules/fundraising-entities/fundraising-entities.validation";

const router = Router();

router.use(authenticate, requireActive);

router.get(
  "/",
  requirePermission(
    PERMISSIONS.INVESTORS_READ,
    PERMISSIONS.INVESTOR_DASHBOARD_READ,
    PERMISSIONS.INVESTOR_CRM_READ,
  ),
  asyncHandler(async (_req, res) => {
    const data = await fundraisingEntityService.list();
    res.json({ data });
  }),
);

router.post(
  "/",
  requirePermission(PERMISSIONS.INVESTORS_UPDATE),
  asyncHandler(async (req, res) => {
    const input = createFundraisingEntitySchema.parse(req.body);
    const data = await fundraisingEntityService.create(input);
    res.status(201).json({ data });
  }),
);

// Literal path before the :key param route so Express matches it first.
router.put(
  "/reorder",
  requirePermission(PERMISSIONS.INVESTORS_UPDATE),
  asyncHandler(async (req, res) => {
    const input = reorderFundraisingEntitiesSchema.parse(req.body);
    const data = await fundraisingEntityService.reorder(input);
    res.json({ data });
  }),
);

router.put(
  "/:key",
  requirePermission(PERMISSIONS.INVESTORS_UPDATE),
  asyncHandler(async (req, res) => {
    const input = updateFundraisingEntitySchema.parse(req.body);
    const data = await fundraisingEntityService.update(
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
    const data = await fundraisingEntityService.delete(
      req.params.key as string,
    );
    res.json({ data });
  }),
);

export default router;
