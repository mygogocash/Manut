import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { PERMISSIONS } from "@nexora/contracts";
import {
  createFundraisingEntitySchema,
  reorderFundraisingEntitiesSchema,
  updateFundraisingEntitySchema,
} from "@nexora/contracts/modules/fundraising-entities/fundraising-entities.validation";
import { fundraisingEntitiesService } from "@nexora/core";
import type { AppEnv } from "../lib/context";
import { requirePermission } from "../middleware/rbac";

const readEntities = requirePermission(
  PERMISSIONS.INVESTORS_READ,
  PERMISSIONS.INVESTOR_DASHBOARD_READ,
  PERMISSIONS.INVESTOR_CRM_READ,
);

export const fundraisingEntities = new Hono<AppEnv>()
  .get("/", readEntities, async (c) => c.json({ data: await fundraisingEntitiesService.list(c.var.db) }))
  .post("/", requirePermission(PERMISSIONS.INVESTORS_UPDATE), zValidator("json", createFundraisingEntitySchema), async (c) => {
    const data = await fundraisingEntitiesService.create(c.var.db, c.req.valid("json"));
    return c.json({ data }, 201);
  })
  .put(
    "/reorder",
    requirePermission(PERMISSIONS.INVESTORS_UPDATE),
    zValidator("json", reorderFundraisingEntitiesSchema),
    async (c) => c.json({ data: await fundraisingEntitiesService.reorder(c.var.db, c.req.valid("json")) }),
  )
  .put(
    "/:key",
    requirePermission(PERMISSIONS.INVESTORS_UPDATE),
    zValidator("json", updateFundraisingEntitySchema),
    async (c) => c.json({ data: await fundraisingEntitiesService.update(c.var.db, c.req.param("key"), c.req.valid("json")) }),
  )
  .delete("/:key", requirePermission(PERMISSIONS.INVESTORS_UPDATE), async (c) =>
    c.json({ data: await fundraisingEntitiesService.remove(c.var.db, c.req.param("key")) }),
  );
