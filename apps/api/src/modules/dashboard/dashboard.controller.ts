import { Router } from "express";

import { PERMISSIONS } from "@/common/constants/permissions";
import {
  authenticate,
  requireActive,
  requirePermission,
} from "@/core/guards/auth.guard";
import { asyncHandler } from "@/core/middleware/async-handler";
import { dashboardService } from "@/modules/dashboard/dashboard.service";

const router = Router();

router.use(authenticate, requireActive);

router.get(
  "/stats",
  requirePermission(PERMISSIONS.HOME_READ),
  asyncHandler(async (req, res) => {
    const data = await dashboardService.getStats(
      req.user!.id,
      req.user!.permissions,
    );
    res.json({ data });
  }),
);

export default router;
