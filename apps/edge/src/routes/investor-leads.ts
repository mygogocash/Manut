import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { PERMISSIONS } from "@nexora/contracts";
import {
  createInvestorLeadSchema,
  listInvestorLeadsSchema,
  updateInvestorLeadSchema,
} from "@nexora/contracts/modules/investor-leads/investor-leads.validation";
import { investorLeadsService } from "@nexora/core";
import type { AppEnv } from "../lib/context";
import { requirePermission } from "../middleware/rbac";

export const investorLeads = new Hono<AppEnv>()
  .get("/", requirePermission(PERMISSIONS.INVESTORS_READ), zValidator("query", listInvestorLeadsSchema), async (c) =>
    c.json(await investorLeadsService.list(c.var.db, c.var.user!.id, c.var.user!.permissions, c.req.valid("query"))),
  )
  .post("/", requirePermission(PERMISSIONS.INVESTORS_CREATE), zValidator("json", createInvestorLeadSchema), async (c) => {
    const data = await investorLeadsService.create(c.var.db, c.var.user!.id, c.req.valid("json"));
    return c.json({ data }, 201);
  })
  .get("/:id", requirePermission(PERMISSIONS.INVESTORS_READ), async (c) =>
    c.json({ data: await investorLeadsService.getById(c.var.db, c.req.param("id"), c.var.user!.id, c.var.user!.permissions) }),
  )
  .post("/:id/archive", requirePermission(PERMISSIONS.INVESTORS_UPDATE), async (c) =>
    c.json({ data: await investorLeadsService.archive(c.var.db, c.req.param("id"), c.var.user!.id, c.var.user!.permissions) }),
  )
  .post("/:id/unarchive", requirePermission(PERMISSIONS.INVESTORS_UPDATE), async (c) =>
    c.json({ data: await investorLeadsService.unarchive(c.var.db, c.req.param("id"), c.var.user!.id, c.var.user!.permissions) }),
  )
  .put(
    "/:id",
    requirePermission(PERMISSIONS.INVESTORS_UPDATE),
    zValidator("json", updateInvestorLeadSchema),
    async (c) =>
      c.json({
        data: await investorLeadsService.update(
          c.var.db,
          c.req.param("id"),
          c.var.user!.id,
          c.var.user!.permissions,
          c.req.valid("json"),
        ),
      }),
  )
  .delete("/:id", requirePermission(PERMISSIONS.INVESTORS_DELETE), async (c) => {
    await investorLeadsService.remove(c.var.db, c.req.param("id"), c.var.user!.id, c.var.user!.permissions);
    return c.json({ data: { success: true } });
  });
