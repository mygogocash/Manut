import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { PERMISSIONS } from "@nexora/contracts";
import {
  createInvestorAccountSchema,
  listInvestorAccountsSchema,
  updateInvestorAccountSchema,
} from "@nexora/contracts/modules/investor-accounts/investor-accounts.validation";
import { investorAccountsService } from "@nexora/core";
import type { AppEnv } from "../lib/context";
import { requirePermission } from "../middleware/rbac";

export const investorAccounts = new Hono<AppEnv>()
  .get("/", requirePermission(PERMISSIONS.INVESTORS_READ), zValidator("query", listInvestorAccountsSchema), async (c) =>
    c.json(await investorAccountsService.list(c.var.db, c.var.user!.id, c.var.user!.permissions, c.req.valid("query"))),
  )
  .post("/", requirePermission(PERMISSIONS.INVESTORS_CREATE), zValidator("json", createInvestorAccountSchema), async (c) => {
    const data = await investorAccountsService.create(c.var.db, c.var.user!.id, c.req.valid("json"));
    return c.json({ data }, 201);
  })
  .get("/:id", requirePermission(PERMISSIONS.INVESTORS_READ), async (c) =>
    c.json({ data: await investorAccountsService.getById(c.var.db, c.req.param("id"), c.var.user!.id, c.var.user!.permissions) }),
  )
  .post("/:id/archive", requirePermission(PERMISSIONS.INVESTORS_UPDATE), async (c) =>
    c.json({ data: await investorAccountsService.archive(c.var.db, c.req.param("id"), c.var.user!.id, c.var.user!.permissions) }),
  )
  .post("/:id/unarchive", requirePermission(PERMISSIONS.INVESTORS_UPDATE), async (c) =>
    c.json({ data: await investorAccountsService.unarchive(c.var.db, c.req.param("id"), c.var.user!.id, c.var.user!.permissions) }),
  )
  .put(
    "/:id",
    requirePermission(PERMISSIONS.INVESTORS_UPDATE),
    zValidator("json", updateInvestorAccountSchema),
    async (c) =>
      c.json({
        data: await investorAccountsService.update(
          c.var.db,
          c.req.param("id"),
          c.var.user!.id,
          c.var.user!.permissions,
          c.req.valid("json"),
        ),
      }),
  )
  .delete("/:id", requirePermission(PERMISSIONS.INVESTORS_DELETE), async (c) => {
    await investorAccountsService.remove(c.var.db, c.req.param("id"), c.var.user!.id, c.var.user!.permissions);
    return c.json({ data: { success: true } });
  });
