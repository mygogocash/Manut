import { Router } from "express";

import { PERMISSIONS } from "@/common/constants/permissions";
import { authenticate, requirePermission } from "@/core/guards/auth.guard";
import { asyncHandler } from "@/core/middleware/async-handler";
import { usageService } from "@/modules/admin/usage/usage.service";

const router = Router();

router.get(
  "/totals",
  authenticate,
  requirePermission(PERMISSIONS.ADMIN_USAGE_REPORT),
  asyncHandler(async (_req, res) => {
    const data = await usageService.getTotals();
    res.json({ data });
  }),
);

router.get(
  "/storage",
  authenticate,
  requirePermission(PERMISSIONS.ADMIN_USAGE_REPORT),
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const search =
      typeof req.query.search === "string" ? req.query.search : undefined;
    const result = await usageService.listUserStorage({
      page,
      limit,
      search,
    });
    res.json(result);
  }),
);

router.get(
  "/buckets",
  authenticate,
  requirePermission(PERMISSIONS.ADMIN_USAGE_REPORT),
  asyncHandler(async (_req, res) => {
    const data = await usageService.getBucketHealth();
    res.json({ data });
  }),
);

router.get(
  "/activity",
  authenticate,
  requirePermission(PERMISSIONS.ADMIN_USAGE_REPORT),
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const search =
      typeof req.query.search === "string" ? req.query.search : undefined;
    const result = await usageService.listUserActivity({
      page,
      limit,
      search,
    });
    res.json(result);
  }),
);

export default router;
