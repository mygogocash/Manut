import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { PERMISSIONS } from "@nexora/contracts";
import {
  bulkFieldUpdateLeadsSchema,
  bulkUpdateLeadsSchema,
  convertLeadSchema,
  createLeadSchema,
  disqualifyLeadSchema,
  listLeadsSchema,
  listStaleLeadsSchema,
  updateLeadSchema,
} from "@nexora/contracts/modules/leads/leads.validation";
import { leadsService } from "@nexora/core";
import type { AppEnv } from "../lib/context";
import { requirePermission } from "../middleware/rbac";

export const leads = new Hono<AppEnv>()
  .get("/", requirePermission(PERMISSIONS.CRM_READ), zValidator("query", listLeadsSchema), async (c) =>
    c.json(
      await leadsService.list(c.var.db, c.var.user!.id, c.var.user!.permissions, c.req.valid("query")),
    ),
  )
  .get(
    "/stale",
    requirePermission(PERMISSIONS.CRM_READ),
    zValidator("query", listStaleLeadsSchema),
    async (c) =>
      c.json(
        await leadsService.listStale(
          c.var.db,
          c.var.user!.id,
          c.var.user!.permissions,
          c.req.valid("query"),
        ),
      ),
  )
  .post(
    "/",
    requirePermission(PERMISSIONS.CRM_CREATE),
    zValidator("json", createLeadSchema),
    async (c) => {
      const data = await leadsService.create(c.var.db, c.var.user!.id, c.req.valid("json"));
      return c.json({ data }, 201);
    },
  )
  .post(
    "/bulk-update",
    requirePermission(PERMISSIONS.CRM_UPDATE),
    zValidator("json", bulkFieldUpdateLeadsSchema),
    async (c) =>
      c.json({
        data: await leadsService.bulkUpdateFields(
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
    zValidator("json", bulkUpdateLeadsSchema),
    async (c) =>
      c.json({
        data: await leadsService.bulkUpdateBusinessUnits(
          c.var.db,
          c.var.user!.id,
          c.var.user!.permissions,
          c.req.valid("json"),
        ),
      }),
  )
  .get("/:id", requirePermission(PERMISSIONS.CRM_READ), async (c) =>
    c.json({
      data: await leadsService.getById(
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
    zValidator("json", updateLeadSchema),
    async (c) =>
      c.json({
        data: await leadsService.update(
          c.var.db,
          c.req.param("id"),
          c.var.user!.id,
          c.var.user!.permissions,
          c.req.valid("json"),
        ),
      }),
  )
  .post(
    "/:id/convert",
    requirePermission(PERMISSIONS.CRM_UPDATE),
    zValidator("json", convertLeadSchema),
    async (c) => {
      const data = await leadsService.convert(
        c.var.db,
        c.req.param("id"),
        c.var.user!.id,
        c.var.user!.permissions,
        c.req.valid("json"),
      );
      return c.json({ data }, 201);
    },
  )
  .post(
    "/:id/disqualify",
    requirePermission(PERMISSIONS.CRM_UPDATE),
    zValidator("json", disqualifyLeadSchema),
    async (c) =>
      c.json({
        data: await leadsService.disqualify(
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
      data: await leadsService.archive(
        c.var.db,
        c.req.param("id"),
        c.var.user!.id,
        c.var.user!.permissions,
      ),
    }),
  )
  .post("/:id/unarchive", requirePermission(PERMISSIONS.CRM_UPDATE), async (c) =>
    c.json({
      data: await leadsService.unarchive(
        c.var.db,
        c.req.param("id"),
        c.var.user!.id,
        c.var.user!.permissions,
      ),
    }),
  )
  .delete("/:id", requirePermission(PERMISSIONS.CRM_DELETE), async (c) => {
    await leadsService.remove(
      c.var.db,
      c.req.param("id"),
      c.var.user!.id,
      c.var.user!.permissions,
    );
    return c.json({ data: { success: true } });
  });
