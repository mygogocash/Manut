import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { PERMISSIONS } from "@nexora/contracts";
import {
  createContactSchema,
  listContactsSchema,
  updateContactSchema,
} from "@nexora/contracts/modules/contacts/contacts.validation";
import { contactsService } from "@nexora/core";
import type { AppEnv } from "../lib/context";
import { requirePermission } from "../middleware/rbac";

export const contacts = new Hono<AppEnv>()
  .get("/", requirePermission(PERMISSIONS.CRM_READ), zValidator("query", listContactsSchema), async (c) =>
    c.json(
      await contactsService.list(c.var.db, c.var.user!.id, c.var.user!.permissions, c.req.valid("query")),
    ),
  )
  .post(
    "/",
    requirePermission(PERMISSIONS.CRM_CREATE),
    zValidator("json", createContactSchema),
    async (c) => {
      const data = await contactsService.create(
        c.var.db,
        c.var.user!.id,
        c.var.user!.permissions,
        c.req.valid("json"),
      );
      return c.json({ data }, 201);
    },
  )
  .get("/:id", requirePermission(PERMISSIONS.CRM_READ), async (c) =>
    c.json({
      data: await contactsService.getById(
        c.var.db,
        c.req.param("id"),
        c.var.user!.id,
        c.var.user!.permissions,
      ),
    }),
  )
  .put(
    "/:id",
    requirePermission(PERMISSIONS.CRM_UPDATE),
    zValidator("json", updateContactSchema),
    async (c) =>
      c.json({
        data: await contactsService.update(
          c.var.db,
          c.req.param("id"),
          c.var.user!.id,
          c.var.user!.permissions,
          c.req.valid("json"),
        ),
      }),
  )
  .post("/:id/archive", requirePermission(PERMISSIONS.CRM_UPDATE), async (c) =>
    c.json({
      data: await contactsService.archive(
        c.var.db,
        c.req.param("id"),
        c.var.user!.id,
        c.var.user!.permissions,
      ),
    }),
  )
  .post("/:id/unarchive", requirePermission(PERMISSIONS.CRM_UPDATE), async (c) =>
    c.json({
      data: await contactsService.unarchive(
        c.var.db,
        c.req.param("id"),
        c.var.user!.id,
        c.var.user!.permissions,
      ),
    }),
  )
  .delete("/:id", requirePermission(PERMISSIONS.CRM_DELETE), async (c) => {
    await contactsService.remove(
      c.var.db,
      c.req.param("id"),
      c.var.user!.id,
      c.var.user!.permissions,
    );
    return c.json({ data: { success: true } });
  });
