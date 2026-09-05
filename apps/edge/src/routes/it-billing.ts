import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { PERMISSIONS } from "@nexora/contracts";
import {
  createSubscriptionSchema,
  createVendorSchema,
  licenseReportQuerySchema,
  monthDetailQuerySchema,
  monthlySeriesQuerySchema,
  renewalDecisionSchema,
  subscriptionQuerySchema,
  updateSubscriptionSchema,
  updateVendorSchema,
} from "@nexora/contracts/modules/it-billing/it-billing.validation";
import { itBillingService } from "@nexora/core";
import type { AppEnv } from "../lib/context";
import { requirePermission } from "../middleware/rbac";

const VIEW = [PERMISSIONS.IT_BILLING_VIEW, PERMISSIONS.IT_BILLING_MANAGE] as const;
const MANAGE = [PERMISSIONS.IT_BILLING_MANAGE] as const;

function notImplemented(message: string) {
  return (c: { json: (body: unknown, status?: number) => Response }) =>
    c.json({ error: { code: "NOT_IMPLEMENTED", message } }, 501);
}

export const itBilling = new Hono<AppEnv>()
  .get("/reports/monthly-spend", requirePermission(...VIEW), async (c) =>
    c.json(await itBillingService.monthlySpendReport(c.var.db)),
  )
  .get(
    "/reports/monthly-series",
    requirePermission(...VIEW),
    zValidator("query", monthlySeriesQuerySchema),
    async (c) => c.json(await itBillingService.monthlySeriesReport(c.var.db, c.req.valid("query"))),
  )
  .get(
    "/reports/monthly-detail",
    requirePermission(...VIEW),
    zValidator("query", monthDetailQuerySchema),
    async (c) => c.json(await itBillingService.monthlyDetailReport(c.var.db, c.req.valid("query"))),
  )
  .get("/reports/vendor-cost", requirePermission(...VIEW), async (c) =>
    c.json(await itBillingService.vendorCostReport(c.var.db)),
  )
  .get("/reports/upcoming-renewals", requirePermission(...VIEW), async (c) => {
    const daysRaw = c.req.query("days");
    const days = daysRaw ? Number(daysRaw) : undefined;
    return c.json(await itBillingService.upcomingRenewalsReport(c.var.db, days));
  })
  .get(
    "/reports/license-utilization",
    requirePermission(...VIEW),
    zValidator("query", licenseReportQuerySchema),
    async (c) => c.json(await itBillingService.licenseUtilizationReport(c.var.db, c.req.valid("query"))),
  )
  .get("/reports/license-summary", requirePermission(...VIEW), async (c) =>
    c.json(await itBillingService.licenseSummary(c.var.db)),
  )
  .get("/renewal-decisions/pending", requirePermission(...VIEW), async (c) =>
    c.json(await itBillingService.pendingRenewalDecisions(c.var.db)),
  )
  .get("/alerts", requirePermission(...VIEW), async (c) =>
    c.json(await itBillingService.listAlerts(c.var.db, c.req.query("open") === "true")),
  )
  .post("/alerts/:id/acknowledge", requirePermission(...MANAGE), async (c) =>
    c.json(await itBillingService.acknowledgeAlert(c.var.db, c.req.param("id"), c.var.user!.id)),
  )
  .get("/vendors", requirePermission(...VIEW), async (c) => c.json(await itBillingService.listVendors(c.var.db)))
  .post(
    "/vendors",
    requirePermission(...MANAGE),
    zValidator("json", createVendorSchema),
    async (c) => {
      const data = await itBillingService.createVendor(c.var.db, c.req.valid("json"), c.var.user!.id);
      return c.json(data, 201);
    },
  )
  .patch(
    "/vendors/:id",
    requirePermission(...MANAGE),
    zValidator("json", updateVendorSchema),
    async (c) => c.json(await itBillingService.updateVendor(c.var.db, c.req.param("id"), c.req.valid("json"))),
  )
  .delete("/vendors/:id", requirePermission(...MANAGE), async (c) =>
    c.json(await itBillingService.deleteVendor(c.var.db, c.req.param("id"))),
  )
  .post(
    "/vendors/:id/attachments",
    requirePermission(...MANAGE),
    notImplemented("Vendor attachments are not available on edge yet"),
  )
  .delete(
    "/vendors/:id/attachments",
    requirePermission(...MANAGE),
    notImplemented("Vendor attachments are not available on edge yet"),
  )
  .get(
    "/subscriptions/:id/records",
    requirePermission(...VIEW),
    notImplemented("Subscription billing records are not available on edge yet"),
  )
  .post(
    "/subscriptions/:id/records",
    requirePermission(...MANAGE),
    notImplemented("Subscription billing records are not available on edge yet"),
  )
  .patch("/records/:id", requirePermission(...MANAGE), notImplemented("Subscription billing records are not available on edge yet"))
  .delete("/records/:id", requirePermission(...MANAGE), notImplemented("Subscription billing records are not available on edge yet"))
  .get(
    "/subscriptions",
    requirePermission(...VIEW),
    zValidator("query", subscriptionQuerySchema),
    async (c) => c.json(await itBillingService.listSubscriptions(c.var.db, c.req.valid("query"))),
  )
  .post(
    "/subscriptions",
    requirePermission(...MANAGE),
    zValidator("json", createSubscriptionSchema),
    async (c) => {
      const data = await itBillingService.createSubscription(c.var.db, c.req.valid("json"), c.var.user!.id);
      return c.json(data, 201);
    },
  )
  .get("/subscriptions/:id", requirePermission(...VIEW), async (c) =>
    c.json(await itBillingService.getSubscription(c.var.db, c.req.param("id"))),
  )
  .patch(
    "/subscriptions/:id",
    requirePermission(...MANAGE),
    zValidator("json", updateSubscriptionSchema),
    async (c) =>
      c.json(await itBillingService.updateSubscription(c.var.db, c.req.param("id"), c.req.valid("json"))),
  )
  .delete("/subscriptions/:id", requirePermission(...MANAGE), async (c) =>
    c.json(await itBillingService.deleteSubscription(c.var.db, c.req.param("id"))),
  )
  .post(
    "/subscriptions/:id/renewal-decision",
    requirePermission(...MANAGE),
    zValidator("json", renewalDecisionSchema),
    async (c) =>
      c.json(
        await itBillingService.recordRenewalDecision(
          c.var.db,
          c.req.param("id"),
          c.req.valid("json"),
          c.var.user!.id,
        ),
      ),
  )
  .post(
    "/subscriptions/:id/attachments",
    requirePermission(...MANAGE),
    notImplemented("Subscription attachments are not available on edge yet"),
  )
  .delete(
    "/subscriptions/:id/attachments",
    requirePermission(...MANAGE),
    notImplemented("Subscription attachments are not available on edge yet"),
  )
  .get("/", requirePermission(...VIEW), zValidator("query", subscriptionQuerySchema), async (c) =>
    c.json(await itBillingService.list(c.var.db, c.var.user!.id, c.var.user!.permissions, c.req.valid("query"))),
  )
  .get("/:id", requirePermission(...VIEW), async (c) =>
    c.json(await itBillingService.getById(c.var.db, c.req.param("id"))),
  );
