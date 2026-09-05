import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { PERMISSIONS } from "@nexora/contracts";
import { applicationQuerySchema } from "@nexora/contracts/modules/applications/applications.validation";
import { applicationsService } from "@nexora/core";
import type { AppEnv } from "../lib/context";
import { requirePermission } from "../middleware/rbac";

export const applications = new Hono<AppEnv>()
  .get("/", requirePermission(PERMISSIONS.APPLICATION_READ), zValidator("query", applicationQuerySchema), async (c) => {
    return c.json(await applicationsService.listApplications(c.var.db, c.req.valid("query")));
  })
  .get("/export", requirePermission(PERMISSIONS.APPLICATION_READ), async (c) => {
    const jobId = c.req.query("jobId") || undefined;
    const search = c.req.query("search") || undefined;
    const csv = await applicationsService.exportCsv(c.var.db, { jobId, search });
    const day = new Date().toISOString().slice(0, 10);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="applications-${day}.csv"`,
      },
    });
  })
  .get("/:id", requirePermission(PERMISSIONS.APPLICATION_READ), async (c) => {
    const data = await applicationsService.getApplicationById(c.var.db, c.req.param("id"));
    return c.json({ data });
  })
  .delete("/:id", requirePermission(PERMISSIONS.APPLICATION_DELETE), async (c) => {
    await applicationsService.deleteApplication(c.var.db, c.req.param("id"));
    return c.json({ data: { success: true } });
  });
