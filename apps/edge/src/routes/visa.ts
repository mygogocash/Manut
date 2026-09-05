import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { PERMISSIONS } from "@nexora/contracts";
import {
  createVisaSchema,
  parseScanSchema,
  updateVisaSchema,
  visaQuerySchema,
} from "@nexora/contracts/modules/visa/visa.validation";
import { visaService } from "@nexora/core";
import type { AppEnv } from "../lib/context";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/rbac";
import { BadRequestException, NotFoundException } from "../lib/errors";

const visaRead = [PERMISSIONS.VISA_READ, PERMISSIONS.VISA_HR_READ, PERMISSIONS.VISA_MANAGE] as const;
const importRowsSchema = z.object({
  rows: z.array(z.record(z.unknown())).min(1),
});

export const visa = new Hono<AppEnv>()
  .get("/", requirePermission(...visaRead), zValidator("query", visaQuerySchema), async (c) =>
    c.json(await visaService.list(c.var.db, c.var.user!.id, c.var.user!.permissions, c.req.valid("query"))),
  )
  .post(
    "/",
    requirePermission(PERMISSIONS.VISA_MANAGE),
    zValidator("json", createVisaSchema),
    async (c) => {
      const data = await visaService.create(c.var.db, c.req.valid("json"), c.var.user!.id);
      return c.json({ data }, 201);
    },
  )
  .post(
    "/parse-scan",
    requirePermission(PERMISSIONS.VISA_MANAGE),
    zValidator("json", parseScanSchema),
    async (c) => c.json({ data: await visaService.parseDocumentScan(c.var.db, c.req.valid("json")) }),
  )
  .get("/notification-config", requirePermission(PERMISSIONS.VISA_MANAGE), async (c) =>
    c.json({ data: await visaService.getNotificationConfig(c.var.db) }),
  )
  .put(
    "/notification-config/recipients",
    requirePermission(PERMISSIONS.VISA_MANAGE),
    zValidator("json", z.object({ emails: z.array(z.string()).optional() })),
    async (c) =>
      c.json({
        data: await visaService.setNotificationRecipients(
          c.var.db,
          c.req.valid("json").emails ?? [],
        ),
      }),
  )
  .put(
    "/notification-config/lead-days",
    requirePermission(PERMISSIONS.VISA_MANAGE),
    zValidator("json", z.object({ leadDays: z.array(z.unknown()).optional() })),
    async (c) =>
      c.json({
        data: await visaService.setNotificationLeadDays(c.var.db, c.req.valid("json").leadDays ?? []),
      }),
  )
  .put(
    "/notification-config/notify-employee",
    requirePermission(PERMISSIONS.VISA_MANAGE),
    zValidator("json", z.object({ notifyEmployee: z.boolean() })),
    async (c) =>
      c.json({
        data: await visaService.setNotificationNotifyEmployee(
          c.var.db,
          c.req.valid("json").notifyEmployee,
        ),
      }),
  )
  .post(
    "/import/preview",
    requirePermission(PERMISSIONS.VISA_MANAGE),
    zValidator("json", importRowsSchema),
    async (c) => c.json({ data: await visaService.previewImport(c.var.db, c.req.valid("json").rows) }),
  )
  .post(
    "/import/commit",
    requirePermission(PERMISSIONS.VISA_MANAGE),
    zValidator("json", importRowsSchema),
    async (c) => c.json({ data: await visaService.commitImport(c.var.db, c.req.valid("json").rows) }),
  )
  .get("/:id/download", requirePermission(...visaRead), async (c) => {
    const id = c.req.param("id");
    const rawIndex = c.req.query("docIndex");
    const docIndex =
      typeof rawIndex === "string" && rawIndex.length > 0 ? Number(rawIndex) : undefined;
    if (docIndex !== undefined && (!Number.isInteger(docIndex) || docIndex < 0)) {
      throw new BadRequestException("docIndex must be a non-negative integer");
    }
    const data = await visaService.getDocumentDownloadUrl(
      c.var.db,
      id,
      c.var.user!.id,
      c.var.user!.permissions,
      `/api/visa/${id}/file`,
      docIndex,
    );
    return c.json({ data });
  })
  .get("/:id/file", requireAuth, async (c) => {
    const id = c.req.param("id");
    const rawIndex = c.req.query("docIndex");
    const docIndex =
      typeof rawIndex === "string" && rawIndex.length > 0 ? Number(rawIndex) : undefined;
    const { target } = await visaService.assertCanDownloadDocument(
      c.var.db,
      id,
      c.var.user!.id,
      c.var.user!.permissions,
      docIndex,
    );
    const key = visaService.documentR2Key(target.url);
    if (!key) {
      if (target.url.startsWith("http")) return c.redirect(target.url);
      throw new NotFoundException("Document is not available");
    }
    const obj = await c.env.R2_PRIVATE.get(key);
    if (!obj) throw new NotFoundException("Document is not available");
    return new Response(obj.body, {
      headers: {
        "Content-Type": obj.httpMetadata?.contentType ?? "application/octet-stream",
        "Content-Disposition": `attachment; filename="${target.name.replace(/"/g, "")}"`,
      },
    });
  })
  .get("/:id/timeline", requirePermission(PERMISSIONS.VISA_MANAGE), async (c) =>
    c.json({ data: await visaService.getTimeline(c.var.db, c.req.param("id")) }),
  )
  .get("/:id", requirePermission(...visaRead), async (c) =>
    c.json({
      data: await visaService.getById(
        c.var.db,
        c.req.param("id"),
        c.var.user!.id,
        c.var.user!.permissions,
      ),
    }),
  )
  .put(
    "/:id",
    requirePermission(PERMISSIONS.VISA_MANAGE),
    zValidator("json", updateVisaSchema),
    async (c) =>
      c.json({
        data: await visaService.update(
          c.var.db,
          c.req.param("id"),
          c.req.valid("json"),
          c.var.user!.id,
        ),
      }),
  )
  .delete("/:id", requirePermission(PERMISSIONS.VISA_MANAGE), async (c) => {
    await visaService.deleteRecord(c.var.db, c.req.param("id"));
    return c.json({ data: { success: true } });
  })
  .post("/:id/restore", requirePermission(PERMISSIONS.VISA_MANAGE), async (c) =>
    c.json({ data: await visaService.restore(c.var.db, c.req.param("id")) }),
  )
  .delete("/:id/permanent", requirePermission(PERMISSIONS.VISA_MANAGE), async (c) =>
    c.json({ data: await visaService.permanentDelete(c.var.db, c.req.param("id")) }),
  );
