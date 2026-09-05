import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { PERMISSIONS } from "@nexora/contracts";
import {
  bulkImportSchema,
  createVendorSchema,
  updateVendorSchema,
  vendorQuerySchema,
} from "@nexora/contracts/modules/vendors/vendors.validation";
import { vendorsService } from "@nexora/core";
import type { AppEnv } from "../lib/context";
import { requirePermission } from "../middleware/rbac";

export const vendors = new Hono<AppEnv>()
  .get("/", requirePermission(PERMISSIONS.ACCOUNTING_READ), zValidator("query", vendorQuerySchema), async (c) =>
    c.json(await vendorsService.list(c.var.db, c.req.valid("query"))),
  )
  .post(
    "/import",
    requirePermission(PERMISSIONS.ACCOUNTING_CREATE),
    zValidator("json", bulkImportSchema),
    async (c) => c.json(await vendorsService.bulkImport(c.var.db, c.req.valid("json")), 201),
  )
  .post(
    "/",
    requirePermission(PERMISSIONS.ACCOUNTING_CREATE),
    zValidator("json", createVendorSchema),
    async (c) => c.json(await vendorsService.create(c.var.db, c.req.valid("json")), 201),
  )
  .get("/:id", requirePermission(PERMISSIONS.ACCOUNTING_READ), async (c) =>
    c.json(await vendorsService.getById(c.var.db, c.req.param("id"))),
  )
  .put(
    "/:id",
    requirePermission(PERMISSIONS.ACCOUNTING_CREATE),
    zValidator("json", updateVendorSchema),
    async (c) => c.json(await vendorsService.update(c.var.db, c.req.param("id"), c.req.valid("json"))),
  )
  .post("/:id/restore", requirePermission(PERMISSIONS.ACCOUNTING_ADMIN), async (c) =>
    c.json(await vendorsService.restore(c.var.db, c.req.param("id"))),
  )
  .delete("/:id", requirePermission(PERMISSIONS.ACCOUNTING_ADMIN), async (c) =>
    c.json(await vendorsService.remove(c.var.db, c.req.param("id"))),
  );
