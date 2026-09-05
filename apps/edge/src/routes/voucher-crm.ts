import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { PERMISSIONS } from "@nexora/contracts";
import {
  createVoucherEntrySchema,
  importVoucherEntriesSchema,
  reorderVoucherEntriesSchema,
  updateVoucherEntrySchema,
  voucherQuerySchema,
} from "@nexora/contracts/modules/voucher-crm/voucher-crm.validation";
import { voucherCrmService } from "@nexora/core";
import type { AppEnv } from "../lib/context";
import { requirePermission } from "../middleware/rbac";

const READ = [PERMISSIONS.VOUCHER_CRM_READ, PERMISSIONS.VOUCHER_CRM_READ_ALL];
const WRITE = [PERMISSIONS.VOUCHER_CRM_UPDATE, PERMISSIONS.VOUCHER_CRM_MANAGE];

export const voucherCrm = new Hono<AppEnv>()
  .get("/", requirePermission(...READ), zValidator("query", voucherQuerySchema), async (c) =>
    c.json(await voucherCrmService.list(c.var.db, c.req.valid("query"))),
  )
  .post("/", requirePermission(PERMISSIONS.VOUCHER_CRM_CREATE, PERMISSIONS.VOUCHER_CRM_MANAGE), zValidator("json", createVoucherEntrySchema), async (c) => {
    const data = await voucherCrmService.create(c.var.db, c.req.valid("json"), c.var.user!.id);
    return c.json({ data }, 201);
  })
  .post("/import", requirePermission(PERMISSIONS.VOUCHER_CRM_CREATE, PERMISSIONS.VOUCHER_CRM_MANAGE), zValidator("json", importVoucherEntriesSchema), async (c) => {
    const data = await voucherCrmService.importRows(c.var.db, c.req.valid("json"), c.var.user!.id);
    return c.json({ data }, 201);
  })
  .put("/reorder", requirePermission(...WRITE), zValidator("json", reorderVoucherEntriesSchema), async (c) =>
    c.json({ data: await voucherCrmService.reorder(c.var.db, c.req.valid("json")) }),
  )
  .get("/:id", requirePermission(...READ), async (c) =>
    c.json({ data: await voucherCrmService.getById(c.var.db, c.req.param("id")) }),
  )
  .put("/:id", requirePermission(...READ, ...WRITE), zValidator("json", updateVoucherEntrySchema), async (c) =>
    c.json({ data: await voucherCrmService.update(c.var.db, c.req.param("id"), c.req.valid("json")) }),
  )
  .delete("/:id", requirePermission(...READ, PERMISSIONS.VOUCHER_CRM_DELETE, PERMISSIONS.VOUCHER_CRM_MANAGE), async (c) =>
    c.json({ data: await voucherCrmService.remove(c.var.db, c.req.param("id")) }),
  )
  .post("/:id/archive", requirePermission(...READ, ...WRITE), async (c) =>
    c.json({ data: await voucherCrmService.archive(c.var.db, c.req.param("id")) }),
  )
  .post("/:id/unarchive", requirePermission(...READ, ...WRITE), async (c) =>
    c.json({ data: await voucherCrmService.unarchive(c.var.db, c.req.param("id")) }),
  );
