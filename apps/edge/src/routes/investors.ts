import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { PERMISSIONS } from "@nexora/contracts";
import {
  bulkDeleteInvestorsSchema,
  bulkTagsInvestorsSchema,
  bulkUpdateInvestorsSchema,
  createInvestorSchema,
  importInvestorsSchema,
  reorderInvestorsSchema,
  updateInvestorSchema,
} from "@nexora/contracts/modules/investors/investors.validation";
import { investorsService } from "@nexora/core";
import type { AppEnv } from "../lib/context";
import { requirePermission } from "../middleware/rbac";

const listInvestorsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(1000).default(20),
  search: z.string().optional(),
  type: z.string().optional(),
  status: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
  archived: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
  fundraisingEntity: z.string().optional(),
  tag: z.string().optional(),
});

export const investors = new Hono<AppEnv>()
  .get("/dashboard", requirePermission(PERMISSIONS.INVESTOR_DASHBOARD_READ), async (c) => {
    const fundraisingEntity = c.req.query("fundraisingEntity");
    return c.json({
      data: await investorsService.dashboard(c.var.db, fundraisingEntity),
    });
  })
  .get("/pipeline-totals", requirePermission(PERMISSIONS.INVESTORS_READ), async (c) => {
    const q = c.req.query();
    const str = (v: string | undefined) => (v?.trim() ? v : undefined);
    return c.json({
      data: await investorsService.pipelineTotals(c.var.db, c.var.user!.id, c.var.user!.permissions, {
        fundraisingEntity: str(q.fundraisingEntity),
        search: str(q.search),
        type: str(q.type),
        tag: str(q.tag),
        archived: q.archived === "true",
      }),
    });
  })
  .get("/", requirePermission(PERMISSIONS.INVESTORS_READ), zValidator("query", listInvestorsQuerySchema), async (c) =>
    c.json(await investorsService.list(c.var.db, c.var.user!.id, c.var.user!.permissions, c.req.valid("query"))),
  )
  .post("/", requirePermission(PERMISSIONS.INVESTORS_CREATE), zValidator("json", createInvestorSchema), async (c) => {
    const data = await investorsService.create(c.var.db, c.var.user!.id, c.req.valid("json"));
    return c.json({ data }, 201);
  })
  .post(
    "/import/preview",
    requirePermission(PERMISSIONS.INVESTORS_CREATE),
    zValidator("json", importInvestorsSchema),
    async (c) => c.json({ data: await investorsService.previewImport(c.var.db, c.req.valid("json")) }),
  )
  .post(
    "/import",
    requirePermission(PERMISSIONS.INVESTORS_CREATE),
    zValidator("json", importInvestorsSchema),
    async (c) =>
      c.json({ data: await investorsService.bulkCreate(c.var.db, c.var.user!.id, c.req.valid("json")) }),
  )
  .post(
    "/reorder",
    requirePermission(PERMISSIONS.INVESTORS_UPDATE),
    zValidator("json", reorderInvestorsSchema),
    async (c) =>
      c.json({
        data: await investorsService.reorder(c.var.db, c.var.user!.id, c.var.user!.permissions, c.req.valid("json")),
      }),
  )
  .post(
    "/bulk-update",
    requirePermission(PERMISSIONS.INVESTORS_UPDATE),
    zValidator("json", bulkUpdateInvestorsSchema),
    async (c) =>
      c.json({
        data: await investorsService.bulkUpdate(c.var.db, c.var.user!.id, c.var.user!.permissions, c.req.valid("json")),
      }),
  )
  .post(
    "/bulk-tags",
    requirePermission(PERMISSIONS.INVESTORS_UPDATE),
    zValidator("json", bulkTagsInvestorsSchema),
    async (c) =>
      c.json({
        data: await investorsService.bulkSetTags(c.var.db, c.var.user!.id, c.var.user!.permissions, c.req.valid("json")),
      }),
  )
  .post(
    "/bulk-delete",
    requirePermission(PERMISSIONS.INVESTORS_DELETE),
    zValidator("json", bulkDeleteInvestorsSchema),
    async (c) =>
      c.json({
        data: await investorsService.bulkDelete(c.var.db, c.var.user!.id, c.var.user!.permissions, c.req.valid("json")),
      }),
  )
  .get("/:id", requirePermission(PERMISSIONS.INVESTORS_READ), async (c) =>
    c.json({ data: await investorsService.getById(c.var.db, c.req.param("id"), c.var.user!.id, c.var.user!.permissions) }),
  )
  .put(
    "/:id",
    requirePermission(PERMISSIONS.INVESTORS_UPDATE),
    zValidator("json", updateInvestorSchema),
    async (c) =>
      c.json({
        data: await investorsService.update(
          c.var.db,
          c.req.param("id"),
          c.var.user!.id,
          c.var.user!.permissions,
          c.req.valid("json"),
        ),
      }),
  )
  .delete("/:id", requirePermission(PERMISSIONS.INVESTORS_DELETE), async (c) => {
    await investorsService.remove(c.var.db, c.req.param("id"), c.var.user!.id, c.var.user!.permissions);
    return c.json({ data: { success: true } });
  })
  .post("/:id/archive", requirePermission(PERMISSIONS.INVESTORS_UPDATE), async (c) =>
    c.json({
      data: await investorsService.archive(c.var.db, c.req.param("id"), c.var.user!.id, c.var.user!.permissions),
    }),
  )
  .post("/:id/unarchive", requirePermission(PERMISSIONS.INVESTORS_UPDATE), async (c) =>
    c.json({
      data: await investorsService.unarchive(c.var.db, c.req.param("id"), c.var.user!.id, c.var.user!.permissions),
    }),
  );
