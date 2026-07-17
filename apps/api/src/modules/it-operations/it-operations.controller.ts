import { Router } from "express";

import { PERMISSIONS } from "@/common/constants/permissions";
import {
  authenticate,
  requireActive,
  requirePermission,
} from "@/core/guards/auth.guard";
import { asyncHandler } from "@/core/middleware/async-handler";
import { itOperationsService } from "@/modules/it-operations/it-operations.service";

const router = Router();
router.use(authenticate, requireActive);

router.get(
  "/dashboard",
  requirePermission(
    PERMISSIONS.IT_DASHBOARD_VIEW,
    PERMISSIONS.IT_BILLING_VIEW,
    PERMISSIONS.IT_ACCESS_VIEW,
    PERMISSIONS.IT_ACCESS_MANAGE,
  ),
  asyncHandler(async (_req, res) => {
    res.json(await itOperationsService.dashboard());
  }),
);

export default router;
