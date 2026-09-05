import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { PERMISSIONS } from "@nexora/contracts";
import {
  createInvestorContactSchema,
  listInvestorContactsSchema,
  updateInvestorContactSchema,
} from "@nexora/contracts/modules/investor-contacts/investor-contacts.validation";
import { investorContactsService } from "@nexora/core";
import type { AppEnv } from "../lib/context";
import { requirePermission } from "../middleware/rbac";

export const investorContacts = new Hono<AppEnv>()
  .get("/", requirePermission(PERMISSIONS.INVESTORS_READ), zValidator("query", listInvestorContactsSchema), async (c) =>
    c.json(await investorContactsService.list(c.var.db, c.var.user!.id, c.var.user!.permissions, c.req.valid("query"))),
  )
  .post("/", requirePermission(PERMISSIONS.INVESTORS_CREATE), zValidator("json", createInvestorContactSchema), async (c) => {
    const data = await investorContactsService.create(c.var.db, c.var.user!.id, c.req.valid("json"));
    return c.json({ data }, 201);
  })
  .get("/:id", requirePermission(PERMISSIONS.INVESTORS_READ), async (c) =>
    c.json({ data: await investorContactsService.getById(c.var.db, c.req.param("id"), c.var.user!.id, c.var.user!.permissions) }),
  )
  .post("/:id/archive", requirePermission(PERMISSIONS.INVESTORS_UPDATE), async (c) =>
    c.json({ data: await investorContactsService.archive(c.var.db, c.req.param("id"), c.var.user!.id, c.var.user!.permissions) }),
  )
  .post("/:id/unarchive", requirePermission(PERMISSIONS.INVESTORS_UPDATE), async (c) =>
    c.json({ data: await investorContactsService.unarchive(c.var.db, c.req.param("id"), c.var.user!.id, c.var.user!.permissions) }),
  )
  .put(
    "/:id",
    requirePermission(PERMISSIONS.INVESTORS_UPDATE),
    zValidator("json", updateInvestorContactSchema),
    async (c) =>
      c.json({
        data: await investorContactsService.update(
          c.var.db,
          c.req.param("id"),
          c.var.user!.id,
          c.var.user!.permissions,
          c.req.valid("json"),
        ),
      }),
  )
  .delete("/:id", requirePermission(PERMISSIONS.INVESTORS_DELETE), async (c) => {
    await investorContactsService.remove(c.var.db, c.req.param("id"), c.var.user!.id, c.var.user!.permissions);
    return c.json({ data: { success: true } });
  });
