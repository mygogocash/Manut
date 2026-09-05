import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { PERMISSIONS } from "@nexora/contracts";
import {
  createLeadSourceSchema,
  listLeadSourcesSchema,
  updateLeadSourceSchema,
} from "@nexora/contracts/modules/lead-sources/lead-sources.validation";
import { leadSourcesService } from "@nexora/core";
import type { AppEnv } from "../lib/context";
import { requirePermission } from "../middleware/rbac";

export const leadSources = new Hono<AppEnv>()
  .get("/", requirePermission(PERMISSIONS.CRM_READ), zValidator("query", listLeadSourcesSchema), async (c) =>
    c.json({ data: await leadSourcesService.list(c.var.db, c.req.valid("query")) }),
  )
  .post(
    "/",
    requirePermission(PERMISSIONS.CRM_ADMIN),
    zValidator("json", createLeadSourceSchema),
    async (c) => {
      const data = await leadSourcesService.create(c.var.db, c.req.valid("json"));
      return c.json({ data }, 201);
    },
  )
  .put(
    "/:id",
    requirePermission(PERMISSIONS.CRM_ADMIN),
    zValidator("json", updateLeadSourceSchema),
    async (c) =>
      c.json({ data: await leadSourcesService.update(c.var.db, c.req.param("id"), c.req.valid("json")) }),
  )
  .delete("/:id", requirePermission(PERMISSIONS.CRM_ADMIN), async (c) => {
    await leadSourcesService.remove(c.var.db, c.req.param("id"));
    return c.json({ data: { success: true } });
  });
