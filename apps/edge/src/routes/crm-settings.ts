import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { PERMISSIONS } from "@nexora/contracts";
import { updateCrmSettingsSchema } from "@nexora/contracts/modules/crm-settings/crm-settings.validation";
import { crmSettingsService } from "@nexora/core";
import type { AppEnv } from "../lib/context";
import { requirePermission } from "../middleware/rbac";

export const crmSettings = new Hono<AppEnv>()
  .get("/", requirePermission(PERMISSIONS.CRM_SETTINGS_MANAGE), async (c) =>
    c.json(await crmSettingsService.getSettings(c.var.db)),
  )
  .put(
    "/",
    requirePermission(PERMISSIONS.CRM_SETTINGS_MANAGE),
    zValidator("json", updateCrmSettingsSchema),
    async (c) =>
      c.json(await crmSettingsService.updateSettings(c.var.db, c.req.valid("json"), c.var.user!.id)),
  );
