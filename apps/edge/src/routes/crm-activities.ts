import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { PERMISSIONS } from "@nexora/contracts";
import {
  createCrmActivitySchema,
  listCrmActivitiesSchema,
  updateCrmActivitySchema,
} from "@nexora/contracts/modules/crm-activities/crm-activities.validation";
import { crmActivitiesService } from "@nexora/core";
import type { AppEnv } from "../lib/context";
import { requirePermission } from "../middleware/rbac";

export const crmActivities = new Hono<AppEnv>()
  .get("/", requirePermission(PERMISSIONS.CRM_READ), zValidator("query", listCrmActivitiesSchema), async (c) =>
    c.json(
      await crmActivitiesService.list(c.var.db, c.var.user!.id, c.var.user!.permissions, c.req.valid("query")),
    ),
  )
  .post(
    "/",
    requirePermission(PERMISSIONS.CRM_CREATE),
    zValidator("json", createCrmActivitySchema),
    async (c) => {
      const data = await crmActivitiesService.create(c.var.db, c.var.user!.id, c.req.valid("json"));
      return c.json({ data }, 201);
    },
  )
  .get("/:id", requirePermission(PERMISSIONS.CRM_READ), async (c) =>
    c.json({
      data: await crmActivitiesService.getById(
        c.var.db,
        c.req.param("id"),
        c.var.user!.id,
        c.var.user!.permissions,
      ),
    }),
  )
  .put(
    "/:id",
    requirePermission(PERMISSIONS.CRM_UPDATE),
    zValidator("json", updateCrmActivitySchema),
    async (c) =>
      c.json({
        data: await crmActivitiesService.update(
          c.var.db,
          c.req.param("id"),
          c.var.user!.id,
          c.var.user!.permissions,
          c.req.valid("json"),
        ),
      }),
  )
  .delete("/:id", requirePermission(PERMISSIONS.CRM_DELETE), async (c) => {
    await crmActivitiesService.remove(
      c.var.db,
      c.req.param("id"),
      c.var.user!.id,
      c.var.user!.permissions,
    );
    return c.json({ data: { success: true } });
  });
