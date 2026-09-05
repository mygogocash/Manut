import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { PERMISSIONS } from "@nexora/contracts";
import {
  dauMauQuerySchema,
  driftRecipientsBodySchema,
  hostBaselineBodySchema,
  metricsQueryBodySchema,
  metricsQuerySchema,
  overviewContentSchema,
  partnerMetricsQuerySchema,
  rawFieldsQuerySchema,
} from "@nexora/contracts/modules/marketing-analytics/marketing-analytics.validation";
import { marketingAnalyticsService } from "@nexora/core";
import type { AppEnv } from "../lib/context";
import { requirePermission } from "../middleware/rbac";

const DASHBOARD = [PERMISSIONS.MARKETING_DASHBOARD_VIEW, PERMISSIONS.MARKETING_RAW_VIEW] as const;
const RAW = [PERMISSIONS.MARKETING_RAW_VIEW] as const;

export const marketingAnalytics = new Hono<AppEnv>()
  .get("/dashboard", requirePermission(...DASHBOARD), async (c) =>
    c.json(await marketingAnalyticsService.dashboard(c.var.db, c.env)),
  )
  .get("/catalog", requirePermission(...DASHBOARD), async (c) =>
    c.json(await marketingAnalyticsService.getCatalog(c.var.db, c.env)),
  )
  .post("/refresh", requirePermission(...DASHBOARD), async (c) =>
    c.json(await marketingAnalyticsService.refresh(c.var.db, c.env)),
  )
  .get("/dau-mau", requirePermission(...DASHBOARD), zValidator("query", dauMauQuerySchema), async (c) =>
    c.json(await marketingAnalyticsService.dauMauDashboard(c.var.db, c.req.valid("query"), c.env)),
  )
  .get("/partners", requirePermission(...DASHBOARD), async (c) =>
    c.json(await marketingAnalyticsService.listPartners(c.var.db, c.env)),
  )
  .put("/partners/:slug/host-baseline", requirePermission(PERMISSIONS.ADMIN_MANAGE), zValidator("json", hostBaselineBodySchema), async (c) => {
    const body = c.req.valid("json");
    return c.json(await marketingAnalyticsService.setPartnerHostBaseline(c.req.param("slug"), body, c.env));
  })
  .delete("/partners/:slug/host-baseline", requirePermission(PERMISSIONS.ADMIN_MANAGE), async (c) =>
    c.json(await marketingAnalyticsService.clearPartnerHostBaseline(c.req.param("slug"), c.env)),
  )
  .get("/drift-settings", requirePermission(...DASHBOARD), async (c) =>
    c.json({ data: { recipients: await marketingAnalyticsService.getDriftRecipients(c.var.db) } }),
  )
  .put("/drift-settings", requirePermission(PERMISSIONS.ADMIN_MANAGE), zValidator("json", driftRecipientsBodySchema), async (c) => {
    const recipients = await marketingAnalyticsService.setDriftRecipients(c.var.db, c.req.valid("json").recipients);
    return c.json({ data: { recipients } });
  })
  .post("/metrics/query", requirePermission(...DASHBOARD), zValidator("json", metricsQueryBodySchema), async (c) =>
    c.json(await marketingAnalyticsService.queryMetrics(c.var.db, c.req.valid("json"), c.env)),
  )
  .get("/overview/content", requirePermission(...DASHBOARD), async (c) =>
    c.json({ data: await marketingAnalyticsService.getOverviewContent(c.var.db, c.env) }),
  )
  .put("/overview/content", requirePermission(PERMISSIONS.ADMIN_MANAGE), zValidator("json", overviewContentSchema), async (c) =>
    c.json({ data: await marketingAnalyticsService.setOverviewContent(c.var.db, c.req.valid("json"), c.env) }),
  )
  .get("/metrics", requirePermission(...RAW), zValidator("query", metricsQuerySchema), async (c) =>
    c.json(await marketingAnalyticsService.listMetrics(c.var.db, c.req.valid("query"), c.env)),
  )
  .get("/raw-fields", requirePermission(...RAW), zValidator("query", rawFieldsQuerySchema), async (c) =>
    c.json(await marketingAnalyticsService.rawFields(c.var.db, c.req.valid("query"), c.env)),
  )
  .get("/partner-metrics", requirePermission(...RAW), zValidator("query", partnerMetricsQuerySchema), async (c) =>
    c.json(await marketingAnalyticsService.partnerMetrics(c.var.db, c.req.valid("query"), c.env)),
  );
