import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { PERMISSIONS } from "@nexora/contracts";
import {
  createNodeAlertSchema,
  updateNodeAlertSchema,
} from "@nexora/contracts/modules/validator-monitor/validator-monitor.validation";
import { validatorMonitorService } from "@nexora/core";
import type { AppEnv } from "../lib/context";
import { requirePermission } from "../middleware/rbac";

export const validatorMonitor = new Hono<AppEnv>()
  .get("/", requirePermission(PERMISSIONS.IT_READ_ALL), async (c) => {
    const forceRefresh = c.req.query("refresh") === "1";
    const data = await validatorMonitorService.getLatestReport(c.var.db, c.env, { forceRefresh });
    return c.json({ data });
  })
  .get("/alerts", requirePermission(PERMISSIONS.IT_READ_ALL), async (c) =>
    c.json({ data: await validatorMonitorService.listAlerts(c.var.db) }),
  )
  .post(
    "/alerts",
    requirePermission(PERMISSIONS.IT_VALIDATOR_ALERT_MANAGE),
    zValidator("json", createNodeAlertSchema),
    async (c) => {
      const data = await validatorMonitorService.createAlert(c.var.db, c.req.valid("json"), c.var.user!.id);
      return c.json({ data }, 201);
    },
  )
  .put(
    "/alerts/:id",
    requirePermission(PERMISSIONS.IT_VALIDATOR_ALERT_MANAGE),
    zValidator("json", updateNodeAlertSchema),
    async (c) => c.json({ data: await validatorMonitorService.updateAlert(c.var.db, c.req.param("id"), c.req.valid("json")) }),
  )
  .delete("/alerts/:id", requirePermission(PERMISSIONS.IT_VALIDATOR_ALERT_MANAGE), async (c) => {
    await validatorMonitorService.deleteAlert(c.var.db, c.req.param("id"));
    return c.body(null, 204);
  });
