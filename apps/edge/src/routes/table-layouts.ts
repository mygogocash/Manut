import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { PERMISSIONS } from "@nexora/contracts";
import {
  tableIdSchema,
  tableLayoutSchema,
} from "@nexora/contracts/modules/table-layouts/table-layouts.validation";
import { tableLayoutsService } from "@nexora/core";
import type { AppEnv } from "../lib/context";
import { BadRequestException } from "../lib/errors";
import { requirePermission } from "../middleware/rbac";

function parseTableId(raw: string): string {
  const parsed = tableIdSchema.safeParse(raw);
  if (!parsed.success) throw new BadRequestException("Invalid table id");
  return parsed.data;
}

export const tableLayouts = new Hono<AppEnv>()
  .get("/:tableId", requirePermission(PERMISSIONS.MARKETING_DASHBOARD_VIEW), async (c) => {
    const tableId = parseTableId(c.req.param("tableId"));
    const data = await tableLayoutsService.get(c.var.db, tableId);
    return c.json({ success: true, data });
  })
  .put(
    "/:tableId",
    requirePermission(PERMISSIONS.ADMIN_MANAGE),
    zValidator("json", tableLayoutSchema),
    async (c) => {
      const tableId = parseTableId(c.req.param("tableId"));
      const data = await tableLayoutsService.set(c.var.db, tableId, c.req.valid("json"));
      return c.json({ success: true, data });
    },
  )
  .delete("/:tableId", requirePermission(PERMISSIONS.ADMIN_MANAGE), async (c) => {
    const tableId = parseTableId(c.req.param("tableId"));
    await tableLayoutsService.clear(c.var.db, tableId);
    return c.body(null, 204);
  });
