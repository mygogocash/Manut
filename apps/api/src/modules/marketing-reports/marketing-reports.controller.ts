import { Router } from "express";

import { PERMISSIONS } from "@/common/constants/permissions";
import {
  authenticate,
  requireActive,
  requirePermission,
} from "@/core/guards/auth.guard";
import { asyncHandler } from "@/core/middleware/async-handler";
import { marketingReportsService as svc } from "@/modules/marketing-reports/marketing-reports.service";
import {
  reportFilterSchema,
  reportListQuerySchema,
  summaryQuerySchema,
} from "@/modules/marketing-reports/marketing-reports.validation";

const router = Router();
router.use(authenticate, requireActive);

// Reports/analytics are open to reports-viewers and campaign-viewers.
const VIEW = [
  PERMISSIONS.MARKETING_REPORTS_VIEW,
  PERMISSIONS.MARKETING_CAMPAIGN_VIEW,
];

function toListArgs(q: ReturnType<typeof reportListQuerySchema.parse>) {
  return {
    filter: {
      from: q.from,
      to: q.to,
      status: q.status,
      channel: q.channel,
      country: q.country,
      ownerId: q.ownerId,
    },
    page: q.page,
    limit: q.limit,
    sortBy: q.sortBy,
    sortDir: q.sortDir,
  };
}

router.get(
  "/dashboard",
  requirePermission(...VIEW),
  asyncHandler(async (req, res) => {
    const filter = reportFilterSchema.parse(req.query);
    res.json(await svc.dashboard(filter));
  }),
);

router.get(
  "/prediction-vs-actual",
  requirePermission(...VIEW),
  asyncHandler(async (req, res) => {
    const q = reportListQuerySchema.parse(req.query);
    res.json(await svc.predictionVsActual(toListArgs(q)));
  }),
);

router.get(
  "/campaign-performance",
  requirePermission(...VIEW),
  asyncHandler(async (req, res) => {
    const q = reportListQuerySchema.parse(req.query);
    res.json(await svc.campaignPerformance(toListArgs(q)));
  }),
);

router.get(
  "/campaign-summary",
  requirePermission(...VIEW),
  asyncHandler(async (req, res) => {
    const q = summaryQuerySchema.parse(req.query);
    res.json(
      await svc.campaignSummary(q.granularity, {
        from: q.from,
        to: q.to,
        status: q.status,
        channel: q.channel,
        country: q.country,
        ownerId: q.ownerId,
      }),
    );
  }),
);

router.get(
  "/prediction-accuracy",
  requirePermission(...VIEW),
  asyncHandler(async (req, res) => {
    const filter = reportFilterSchema.parse(req.query);
    res.json(await svc.predictionAccuracy(filter));
  }),
);

router.get(
  "/lever-performance",
  requirePermission(...VIEW),
  asyncHandler(async (req, res) => {
    const filter = reportFilterSchema.parse(req.query);
    res.json(await svc.leverPerformance(filter));
  }),
);

export default router;
