import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { PERMISSIONS } from "@nexora/contracts";
import {
  createDealSchema,
  listDealsSchema,
  updateDealSchema,
} from "@nexora/contracts/modules/deals/deals.validation";
import { dealsService } from "@nexora/core";
import type { AppEnv } from "../lib/context";
import { requirePermission } from "../middleware/rbac";

export const deals = new Hono<AppEnv>()
  .get("/", requirePermission(PERMISSIONS.DEALS_READ), zValidator("query", listDealsSchema), async (c) =>
    c.json(
      await dealsService.list(c.var.db, c.var.user!.id, c.var.user!.permissions, c.req.valid("query")),
    ),
  )
  .get("/pipeline", requirePermission(PERMISSIONS.DEALS_READ), async (c) =>
    c.json({
      data: await dealsService.getPipelineSummary(c.var.db, c.var.user!.id, c.var.user!.permissions),
    }),
  )
  .post(
    "/",
    requirePermission(PERMISSIONS.DEALS_CREATE),
    zValidator("json", createDealSchema),
    async (c) => {
      const data = await dealsService.create(c.var.db, c.var.user!.id, c.req.valid("json"));
      return c.json({ data }, 201);
    },
  )
  .get("/:id", requirePermission(PERMISSIONS.DEALS_READ), async (c) =>
    c.json({
      data: await dealsService.getById(
        c.var.db,
        c.req.param("id"),
        c.var.user!.id,
        c.var.user!.permissions,
      ),
    }),
  )
  .put(
    "/:id",
    requirePermission(PERMISSIONS.DEALS_UPDATE),
    zValidator("json", updateDealSchema),
    async (c) =>
      c.json({
        data: await dealsService.update(
          c.var.db,
          c.req.param("id"),
          c.var.user!.id,
          c.var.user!.permissions,
          c.req.valid("json"),
        ),
      }),
  )
  .delete("/:id", requirePermission(PERMISSIONS.DEALS_DELETE), async (c) => {
    await dealsService.remove(
      c.var.db,
      c.req.param("id"),
      c.var.user!.id,
      c.var.user!.permissions,
    );
    return c.json({ data: { success: true } });
  });
