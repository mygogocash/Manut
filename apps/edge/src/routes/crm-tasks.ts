import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { PERMISSIONS } from "@nexora/contracts";
import {
  createCrmTaskSchema,
  listCrmTasksSchema,
  updateCrmTaskSchema,
} from "@nexora/contracts/modules/crm-tasks/crm-tasks.validation";
import { crmTasksService } from "@nexora/core";
import type { AppEnv } from "../lib/context";
import { requirePermission } from "../middleware/rbac";

export const crmTasks = new Hono<AppEnv>()
  .get("/", requirePermission(PERMISSIONS.CRM_READ), zValidator("query", listCrmTasksSchema), async (c) =>
    c.json(
      await crmTasksService.list(c.var.db, c.var.user!.id, c.var.user!.permissions, c.req.valid("query")),
    ),
  )
  .post(
    "/",
    requirePermission(PERMISSIONS.CRM_CREATE),
    zValidator("json", createCrmTaskSchema),
    async (c) => {
      const data = await crmTasksService.create(c.var.db, c.var.user!.id, c.req.valid("json"));
      return c.json({ data }, 201);
    },
  )
  .get("/:id", requirePermission(PERMISSIONS.CRM_READ), async (c) =>
    c.json({
      data: await crmTasksService.getById(
        c.var.db,
        c.req.param("id"),
        c.var.user!.id,
        c.var.user!.permissions,
      ),
    }),
  )
  .put("/:id/complete", requirePermission(PERMISSIONS.CRM_UPDATE), async (c) =>
    c.json({
      data: await crmTasksService.complete(
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
    zValidator("json", updateCrmTaskSchema),
    async (c) =>
      c.json({
        data: await crmTasksService.update(
          c.var.db,
          c.req.param("id"),
          c.var.user!.id,
          c.var.user!.permissions,
          c.req.valid("json"),
        ),
      }),
  )
  .delete("/:id", requirePermission(PERMISSIONS.CRM_DELETE), async (c) => {
    await crmTasksService.remove(
      c.var.db,
      c.req.param("id"),
      c.var.user!.id,
      c.var.user!.permissions,
    );
    return c.json({ data: { success: true } });
  });
