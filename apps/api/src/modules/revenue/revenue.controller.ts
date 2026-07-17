import { Router } from "express";

import { PERMISSIONS } from "@/common/constants/permissions";
import {
  authenticate,
  requireActive,
  requirePermission,
} from "@/core/guards/auth.guard";
import { asyncHandler } from "@/core/middleware/async-handler";
import { revenueService } from "@/modules/revenue/revenue.service";
import { revenueQuerySchema } from "@/modules/revenue/revenue.validation";

const router = Router();

router.use(authenticate, requireActive);

router.get(
  "/dashboard",
  requirePermission(PERMISSIONS.REVENUE_READ),
  asyncHandler(async (req, res) => {
    const query = revenueQuerySchema.parse(req.query);
    const data = await revenueService.getDashboard(query);
    res.json({ data });
  }),
);

router.get(
  "/investments",
  requirePermission(PERMISSIONS.REVENUE_READ),
  asyncHandler(async (req, res) => {
    const query = revenueQuerySchema.parse(req.query);
    const data = await revenueService.getInvestments(query);
    res.json({ data });
  }),
);

router.get(
  "/expenses",
  requirePermission(PERMISSIONS.REVENUE_READ),
  asyncHandler(async (req, res) => {
    const query = revenueQuerySchema.parse(req.query);
    const data = await revenueService.getExpenses(query);
    res.json({ data });
  }),
);

router.get(
  "/invoices",
  requirePermission(PERMISSIONS.REVENUE_READ),
  asyncHandler(async (req, res) => {
    const query = revenueQuerySchema.parse(req.query);
    const data = await revenueService.getInvoices(query);
    res.json({ data });
  }),
);

export default router;
