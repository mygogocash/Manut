import { Router } from "express";

import { PERMISSIONS } from "@/common/constants/permissions";
import {
  authenticate,
  requireActive,
  requirePermission,
} from "@/core/guards/auth.guard";
import { asyncHandler } from "@/core/middleware/async-handler";
import { leadSourceService } from "@/modules/revenue-lead-sources/lead-sources.service";
import {
  createLeadSourceSchema,
  listLeadSourcesSchema,
  updateLeadSourceSchema,
} from "@/modules/revenue-lead-sources/lead-sources.validation";

const router = Router();

router.use(authenticate, requireActive);

// Read is gated by `crm:read` so reps can populate the lead-source picker.
router.get(
  "/",
  requirePermission(PERMISSIONS.SALES_REVENUE_READ),
  asyncHandler(async (req, res) => {
    const query = listLeadSourcesSchema.parse(req.query);
    const data = await leadSourceService.list(query);
    res.json({ data });
  }),
);

// All mutations require `crm:admin` — workspace-admin level access.
router.post(
  "/",
  requirePermission(PERMISSIONS.SALES_REVENUE_ADMIN),
  asyncHandler(async (req, res) => {
    const input = createLeadSourceSchema.parse(req.body);
    const data = await leadSourceService.create(input);
    res.status(201).json({ data });
  }),
);

router.put(
  "/:id",
  requirePermission(PERMISSIONS.SALES_REVENUE_ADMIN),
  asyncHandler(async (req, res) => {
    const input = updateLeadSourceSchema.parse(req.body);
    const data = await leadSourceService.update(req.params.id as string, input);
    res.json({ data });
  }),
);

router.delete(
  "/:id",
  requirePermission(PERMISSIONS.SALES_REVENUE_ADMIN),
  asyncHandler(async (req, res) => {
    await leadSourceService.delete(req.params.id as string);
    res.json({ data: { success: true } });
  }),
);

export default router;
