import { Router } from "express";

import { PERMISSIONS } from "@/common/constants/permissions";
import { getRequiredParam } from "@/common/utils/params";
import {
  authenticate,
  requireActive,
  requirePermission,
} from "@/core/guards/auth.guard";
import { asyncHandler } from "@/core/middleware/async-handler";
import { itBillingService } from "@/modules/it-billing/it-billing.service";
import {
  addAttachmentSchema,
  createBillingRecordSchema,
  createSubscriptionSchema,
  createVendorSchema,
  licenseReportQuerySchema,
  monthDetailQuerySchema,
  monthlySeriesQuerySchema,
  removeAttachmentSchema,
  renewalDecisionSchema,
  subscriptionQuerySchema,
  updateBillingRecordSchema,
  updateSubscriptionSchema,
  updateVendorSchema,
} from "@/modules/it-billing/it-billing.validation";

const router = Router();
router.use(authenticate, requireActive);

const VIEW = [PERMISSIONS.IT_BILLING_VIEW, PERMISSIONS.IT_BILLING_MANAGE];
const MANAGE = [PERMISSIONS.IT_BILLING_MANAGE];

// ── Reports (literal, before any "/:id") ──
router.get(
  "/reports/monthly-spend",
  requirePermission(...VIEW),
  asyncHandler(async (_req, res) => {
    res.json(await itBillingService.monthlySpendReport());
  }),
);
// Committed spend per calendar month + what started/ended in each. Distinct
// from /reports/monthly-spend, which is a single run-rate snapshot, not a series.
router.get(
  "/reports/monthly-series",
  requirePermission(...VIEW),
  asyncHandler(async (req, res) => {
    const query = monthlySeriesQuerySchema.parse(req.query);
    res.json(await itBillingService.monthlySeriesReport(query));
  }),
);
router.get(
  "/reports/monthly-detail",
  requirePermission(...VIEW),
  asyncHandler(async (req, res) => {
    const query = monthDetailQuerySchema.parse(req.query);
    res.json(await itBillingService.monthlyDetailReport(query));
  }),
);
router.get(
  "/reports/vendor-cost",
  requirePermission(...VIEW),
  asyncHandler(async (_req, res) => {
    res.json(await itBillingService.vendorCostReport());
  }),
);
router.get(
  "/reports/upcoming-renewals",
  requirePermission(...VIEW),
  asyncHandler(async (req, res) => {
    const days = req.query.days ? Number(req.query.days) : undefined;
    res.json(await itBillingService.upcomingRenewalsReport(days));
  }),
);
router.get(
  "/reports/license-utilization",
  requirePermission(...VIEW),
  asyncHandler(async (req, res) => {
    const query = licenseReportQuerySchema.parse(req.query);
    res.json(await itBillingService.licenseUtilizationReport(query));
  }),
);
router.get(
  "/reports/license-summary",
  requirePermission(...VIEW),
  asyncHandler(async (_req, res) => {
    res.json(await itBillingService.licenseSummary());
  }),
);

// ── Renewal decision workflow ──
router.get(
  "/renewal-decisions/pending",
  requirePermission(...VIEW),
  asyncHandler(async (_req, res) => {
    res.json(await itBillingService.pendingRenewalDecisions());
  }),
);

// ── Alerts ──
router.get(
  "/alerts",
  requirePermission(...VIEW),
  asyncHandler(async (req, res) => {
    res.json(await itBillingService.listAlerts(req.query.open === "true"));
  }),
);
router.post(
  "/alerts/:id/acknowledge",
  requirePermission(...MANAGE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    res.json(await itBillingService.acknowledgeAlert(id, req.user!.id, req));
  }),
);

// ── Vendors ──
router.get(
  "/vendors",
  requirePermission(...VIEW),
  asyncHandler(async (_req, res) => {
    res.json(await itBillingService.listVendors());
  }),
);
router.post(
  "/vendors",
  requirePermission(...MANAGE),
  asyncHandler(async (req, res) => {
    const input = createVendorSchema.parse(req.body);
    res
      .status(201)
      .json(await itBillingService.createVendor(input, req.user!.id, req));
  }),
);
router.patch(
  "/vendors/:id",
  requirePermission(...MANAGE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const input = updateVendorSchema.parse(req.body);
    res.json(await itBillingService.updateVendor(id, input, req.user!.id, req));
  }),
);
router.delete(
  "/vendors/:id",
  requirePermission(...MANAGE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    res.json(await itBillingService.deleteVendor(id, req.user!.id, req));
  }),
);
router.post(
  "/vendors/:id/attachments",
  requirePermission(...MANAGE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const input = addAttachmentSchema.parse(req.body);
    res.json(
      await itBillingService.addVendorAttachment(id, input, req.user!.id, req),
    );
  }),
);
router.delete(
  "/vendors/:id/attachments",
  requirePermission(...MANAGE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const input = removeAttachmentSchema.parse(req.query);
    res.json(
      await itBillingService.removeVendorAttachment(
        id,
        input,
        req.user!.id,
        req,
      ),
    );
  }),
);

// ── Subscription billing records ──
router.get(
  "/subscriptions/:id/records",
  requirePermission(...VIEW),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    res.json(await itBillingService.listBillingRecords(id));
  }),
);
router.post(
  "/subscriptions/:id/records",
  requirePermission(...MANAGE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const input = createBillingRecordSchema.parse(req.body);
    res
      .status(201)
      .json(
        await itBillingService.createBillingRecord(
          id,
          input,
          req.user!.id,
          req,
        ),
      );
  }),
);
router.patch(
  "/records/:id",
  requirePermission(...MANAGE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const input = updateBillingRecordSchema.parse(req.body);
    res.json(
      await itBillingService.updateBillingRecord(id, input, req.user!.id, req),
    );
  }),
);
router.delete(
  "/records/:id",
  requirePermission(...MANAGE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    res.json(await itBillingService.deleteBillingRecord(id, req.user!.id, req));
  }),
);

// ── Subscriptions ──
router.get(
  "/subscriptions",
  requirePermission(...VIEW),
  asyncHandler(async (req, res) => {
    const query = subscriptionQuerySchema.parse(req.query);
    res.json(await itBillingService.listSubscriptions(query));
  }),
);
router.post(
  "/subscriptions",
  requirePermission(...MANAGE),
  asyncHandler(async (req, res) => {
    const input = createSubscriptionSchema.parse(req.body);
    res
      .status(201)
      .json(
        await itBillingService.createSubscription(input, req.user!.id, req),
      );
  }),
);
router.get(
  "/subscriptions/:id",
  requirePermission(...VIEW),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    res.json(await itBillingService.getSubscription(id));
  }),
);
router.patch(
  "/subscriptions/:id",
  requirePermission(...MANAGE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const input = updateSubscriptionSchema.parse(req.body);
    res.json(
      await itBillingService.updateSubscription(id, input, req.user!.id, req),
    );
  }),
);
router.delete(
  "/subscriptions/:id",
  requirePermission(...MANAGE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    res.json(await itBillingService.deleteSubscription(id, req.user!.id, req));
  }),
);
router.post(
  "/subscriptions/:id/renewal-decision",
  requirePermission(...MANAGE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const input = renewalDecisionSchema.parse(req.body);
    res.json(
      await itBillingService.recordRenewalDecision(
        id,
        input,
        req.user!.id,
        req,
      ),
    );
  }),
);
router.post(
  "/subscriptions/:id/attachments",
  requirePermission(...MANAGE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const input = addAttachmentSchema.parse(req.body);
    res.json(
      await itBillingService.addSubscriptionAttachment(
        id,
        input,
        req.user!.id,
        req,
      ),
    );
  }),
);
router.delete(
  "/subscriptions/:id/attachments",
  requirePermission(...MANAGE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const input = removeAttachmentSchema.parse(req.query);
    res.json(
      await itBillingService.removeSubscriptionAttachment(
        id,
        input,
        req.user!.id,
        req,
      ),
    );
  }),
);

export default router;
