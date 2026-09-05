import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { PERMISSIONS } from "@nexora/contracts";
import {
  bulkFieldUpdateAccountsSchema,
  bulkUpdateAccountsSchema,
  createAccountSchema,
  importAccountsSchema,
  listAccountsSchema,
  reorderAccountsSchema,
  updateAccountSchema,
} from "@nexora/contracts/modules/accounts/accounts.validation";
import { accountsService } from "@nexora/core";
import type { AppEnv } from "../lib/context";
import { requirePermission } from "../middleware/rbac";

export const accounts = new Hono<AppEnv>()
  .get("/", requirePermission(PERMISSIONS.CRM_READ), zValidator("query", listAccountsSchema), async (c) =>
    c.json(
      await accountsService.list(c.var.db, c.var.user!.id, c.var.user!.permissions, c.req.valid("query")),
    ),
  )
  .post(
    "/",
    requirePermission(PERMISSIONS.CRM_CREATE),
    zValidator("json", createAccountSchema),
    async (c) => {
      const data = await accountsService.create(
        c.var.db,
        c.var.user!.id,
        c.var.user!.permissions,
        c.req.valid("json"),
      );
      return c.json({ data }, 201);
    },
  )
  .post(
    "/reorder",
    requirePermission(PERMISSIONS.CRM_UPDATE),
    zValidator("json", reorderAccountsSchema),
    async (c) =>
      c.json({
        data: await accountsService.reorder(
          c.var.db,
          c.var.user!.id,
          c.var.user!.permissions,
          c.req.valid("json"),
        ),
      }),
  )
  .post(
    "/import",
    requirePermission(PERMISSIONS.CRM_CREATE),
    zValidator("json", importAccountsSchema),
    async (c) =>
      c.json({
        data: await accountsService.bulkCreate(
          c.var.db,
          c.var.user!.id,
          c.var.user!.permissions,
          c.req.valid("json"),
        ),
      }),
  )
  .post(
    "/bulk-update",
    requirePermission(PERMISSIONS.CRM_UPDATE),
    zValidator("json", bulkFieldUpdateAccountsSchema),
    async (c) =>
      c.json({
        data: await accountsService.bulkUpdateFields(
          c.var.db,
          c.var.user!.id,
          c.var.user!.permissions,
          c.req.valid("json"),
        ),
      }),
  )
  .post(
    "/bulk-business-units",
    requirePermission(PERMISSIONS.CRM_UPDATE),
    zValidator("json", bulkUpdateAccountsSchema),
    async (c) =>
      c.json({
        data: await accountsService.bulkUpdateBusinessUnits(
          c.var.db,
          c.var.user!.id,
          c.var.user!.permissions,
          c.req.valid("json"),
        ),
      }),
  )
  .get("/:id", requirePermission(PERMISSIONS.CRM_READ), async (c) =>
    c.json({
      data: await accountsService.getById(
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
    zValidator("json", updateAccountSchema),
    async (c) =>
      c.json({
        data: await accountsService.update(
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
      data: await accountsService.archive(
        c.var.db,
        c.req.param("id"),
        c.var.user!.id,
        c.var.user!.permissions,
      ),
    }),
  )
  .post("/:id/unarchive", requirePermission(PERMISSIONS.CRM_UPDATE), async (c) =>
    c.json({
      data: await accountsService.unarchive(
        c.var.db,
        c.req.param("id"),
        c.var.user!.id,
        c.var.user!.permissions,
      ),
    }),
  )
  .delete("/:id", requirePermission(PERMISSIONS.CRM_DELETE), async (c) => {
    await accountsService.remove(
      c.var.db,
      c.req.param("id"),
      c.var.user!.id,
      c.var.user!.permissions,
    );
    return c.json({ data: { success: true } });
  });
