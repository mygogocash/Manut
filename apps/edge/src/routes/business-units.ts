import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { PERMISSIONS } from "@nexora/contracts";
import {
  createBusinessUnitSchema,
  listBusinessUnitsSchema,
  reorderBusinessUnitsSchema,
  updateBusinessUnitSchema,
} from "@nexora/contracts/modules/business-units/business-units.validation";
import { businessUnitsService } from "@nexora/core";
import type { AppEnv } from "../lib/context";
import { requirePermission } from "../middleware/rbac";

const READ_PERMS = [PERMISSIONS.CRM_READ, PERMISSIONS.SALES_REVENUE_READ] as const;
const ADMIN_PERMS = [PERMISSIONS.CRM_ADMIN, PERMISSIONS.SALES_REVENUE_ADMIN] as const;

export const businessUnits = new Hono<AppEnv>()
  .get(
    "/",
    requirePermission(...READ_PERMS),
    zValidator("query", listBusinessUnitsSchema),
    async (c) => c.json({ data: await businessUnitsService.list(c.var.db, c.req.valid("query")) }),
  )
  .post(
    "/",
    requirePermission(...ADMIN_PERMS),
    zValidator("json", createBusinessUnitSchema),
    async (c) => {
      const data = await businessUnitsService.create(c.var.db, c.req.valid("json"));
      return c.json({ data }, 201);
    },
  )
  .put(
    "/reorder",
    requirePermission(...ADMIN_PERMS),
    zValidator("json", reorderBusinessUnitsSchema),
    async (c) => c.json({ data: await businessUnitsService.reorder(c.var.db, c.req.valid("json")) }),
  )
  .put(
    "/:id",
    requirePermission(...ADMIN_PERMS),
    zValidator("json", updateBusinessUnitSchema),
    async (c) =>
      c.json({
        data: await businessUnitsService.update(c.var.db, c.req.param("id"), c.req.valid("json")),
      }),
  )
  .delete("/:id", requirePermission(...ADMIN_PERMS), async (c) => {
    await businessUnitsService.remove(c.var.db, c.req.param("id"));
    return c.json({ data: { success: true } });
  });
