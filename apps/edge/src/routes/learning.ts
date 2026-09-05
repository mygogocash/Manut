import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { PERMISSIONS } from "@nexora/contracts";
import {
  completionQuerySchema,
  createCompletionSchema,
  createModuleSchema,
  importModulesSchema,
  moduleQuerySchema,
  updateModuleSchema,
} from "@nexora/contracts/modules/learning/learning.validation";
import { learningService } from "@nexora/core";
import type { AppEnv } from "../lib/context";
import { requirePermission } from "../middleware/rbac";

export const learning = new Hono<AppEnv>()
  .get(
    "/modules",
    requirePermission(
      PERMISSIONS.LEARNING_READ,
      PERMISSIONS.LEARNING_COMPLETE,
      PERMISSIONS.LEARNING_MANAGE,
      PERMISSIONS.LEARNING_HR_READ,
    ),
    zValidator("query", moduleQuerySchema),
    async (c) => c.json(await learningService.listModules(c.var.db, c.req.valid("query"))),
  )
  .post("/modules", requirePermission(PERMISSIONS.LEARNING_MANAGE), zValidator("json", createModuleSchema), async (c) => {
    const data = await learningService.createModule(c.var.db, c.req.valid("json"));
    return c.json({ data }, 201);
  })
  .post("/modules/import", requirePermission(PERMISSIONS.LEARNING_MANAGE), zValidator("json", importModulesSchema), async (c) => {
    const data = await learningService.bulkCreate(c.var.db, c.req.valid("json"));
    return c.json({ data });
  })
  .put("/modules/:id", requirePermission(PERMISSIONS.LEARNING_MANAGE), zValidator("json", updateModuleSchema), async (c) => {
    const data = await learningService.updateModule(c.var.db, c.req.param("id"), c.req.valid("json"));
    return c.json({ data });
  })
  .get(
    "/completions",
    requirePermission(
      PERMISSIONS.LEARNING_READ,
      PERMISSIONS.LEARNING_HR_READ,
      PERMISSIONS.LEARNING_COMPLETE,
      PERMISSIONS.LEARNING_MANAGE,
    ),
    zValidator("query", completionQuerySchema),
    async (c) =>
      c.json(
        await learningService.listCompletions(
          c.var.db,
          c.var.user!.id,
          c.var.user!.permissions,
          c.req.valid("query"),
        ),
      ),
  )
  .post("/completions", requirePermission(PERMISSIONS.LEARNING_COMPLETE), zValidator("json", createCompletionSchema), async (c) => {
    const data = await learningService.markCompleted(c.var.db, c.var.user!.id, c.req.valid("json"));
    return c.json({ data }, 201);
  });
