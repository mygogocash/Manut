import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { PERMISSIONS } from "@nexora/contracts";
import {
  createInvestorTaskSchema,
  listInvestorTasksSchema,
  updateInvestorTaskSchema,
} from "@nexora/contracts/modules/investor-tasks/investor-tasks.validation";
import { investorTasksService } from "@nexora/core";
import type { AppEnv } from "../lib/context";
import { requirePermission } from "../middleware/rbac";

export const investorTasks = new Hono<AppEnv>()
  .get("/", requirePermission(PERMISSIONS.INVESTORS_READ), zValidator("query", listInvestorTasksSchema), async (c) =>
    c.json(await investorTasksService.list(c.var.db, c.var.user!.id, c.var.user!.permissions, c.req.valid("query"))),
  )
  .post("/", requirePermission(PERMISSIONS.INVESTORS_CREATE), zValidator("json", createInvestorTaskSchema), async (c) => {
    const data = await investorTasksService.create(c.var.db, c.var.user!.id, c.var.user!.permissions, c.req.valid("json"));
    return c.json({ data }, 201);
  })
  .get("/:id", requirePermission(PERMISSIONS.INVESTORS_READ), async (c) =>
    c.json({ data: await investorTasksService.getById(c.var.db, c.req.param("id"), c.var.user!.id, c.var.user!.permissions) }),
  )
  .put(
    "/:id/complete",
    requirePermission(PERMISSIONS.INVESTORS_UPDATE),
    async (c) =>
      c.json({
        data: await investorTasksService.complete(
          c.var.db,
          c.req.param("id"),
          c.var.user!.id,
          c.var.user!.permissions,
        ),
      }),
  )
  .put(
    "/:id",
    requirePermission(PERMISSIONS.INVESTORS_UPDATE),
    zValidator("json", updateInvestorTaskSchema),
    async (c) =>
      c.json({
        data: await investorTasksService.update(
          c.var.db,
          c.req.param("id"),
          c.var.user!.id,
          c.var.user!.permissions,
          c.req.valid("json"),
        ),
      }),
  )
  .delete("/:id", requirePermission(PERMISSIONS.INVESTORS_DELETE), async (c) => {
    await investorTasksService.remove(c.var.db, c.req.param("id"), c.var.user!.id, c.var.user!.permissions);
    return c.json({ data: { success: true } });
  });
