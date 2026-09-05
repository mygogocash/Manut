import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { PERMISSIONS } from "@nexora/contracts";
import {
  createInvestorTypeSchema,
  reorderInvestorTypesSchema,
  updateInvestorTypeSchema,
} from "@nexora/contracts/modules/investor-types/investor-types.validation";
import { investorTypesService } from "@nexora/core";
import type { AppEnv } from "../lib/context";
import { requirePermission } from "../middleware/rbac";

export const investorTypes = new Hono<AppEnv>()
  .get("/", requirePermission(PERMISSIONS.INVESTORS_READ), async (c) => c.json({ data: await investorTypesService.list(c.var.db) }))
  .post("/", requirePermission(PERMISSIONS.INVESTORS_UPDATE), zValidator("json", createInvestorTypeSchema), async (c) => {
    const data = await investorTypesService.create(c.var.db, c.req.valid("json"));
    return c.json({ data }, 201);
  })
  .put(
    "/reorder",
    requirePermission(PERMISSIONS.INVESTORS_UPDATE),
    zValidator("json", reorderInvestorTypesSchema),
    async (c) => c.json({ data: await investorTypesService.reorder(c.var.db, c.req.valid("json")) }),
  )
  .put(
    "/:key",
    requirePermission(PERMISSIONS.INVESTORS_UPDATE),
    zValidator("json", updateInvestorTypeSchema),
    async (c) => c.json({ data: await investorTypesService.update(c.var.db, c.req.param("key"), c.req.valid("json")) }),
  )
  .delete("/:key", requirePermission(PERMISSIONS.INVESTORS_UPDATE), async (c) =>
    c.json({ data: await investorTypesService.remove(c.var.db, c.req.param("key")) }),
  );
