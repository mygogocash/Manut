import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { PERMISSIONS } from "@nexora/contracts";
import {
  createJobSchema,
  jobQuerySchema,
  updateJobSchema,
} from "@nexora/contracts/modules/career/career.validation";
import { careerService } from "@nexora/core";
import type { AppEnv } from "../lib/context";
import { requirePermission } from "../middleware/rbac";

export const career = new Hono<AppEnv>()
  .get("/", requirePermission(PERMISSIONS.CAREER_READ), zValidator("query", jobQuerySchema), async (c) => {
    return c.json(await careerService.listJobs(c.var.db, c.req.valid("query")));
  })
  .get("/titles", requirePermission(PERMISSIONS.CAREER_READ), async (c) => {
    return c.json({ data: await careerService.getJobTitles(c.var.db) });
  })
  .get("/export", requirePermission(PERMISSIONS.CAREER_READ), async (c) => {
    const search = c.req.query("search") || undefined;
    const csv = await careerService.exportCsv(c.var.db, { search });
    const day = new Date().toISOString().slice(0, 10);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="jobs-${day}.csv"`,
      },
    });
  })
  .post("/", requirePermission(PERMISSIONS.CAREER_CREATE), zValidator("json", createJobSchema), async (c) => {
    const data = await careerService.createJob(c.var.db, c.req.valid("json"));
    return c.json({ data }, 201);
  })
  .get("/:id", requirePermission(PERMISSIONS.CAREER_READ), async (c) => {
    const data = await careerService.getJobById(c.var.db, c.req.param("id"));
    return c.json({ data });
  })
  .put("/:id", requirePermission(PERMISSIONS.CAREER_UPDATE), zValidator("json", updateJobSchema), async (c) => {
    const data = await careerService.updateJob(c.var.db, c.req.param("id"), c.req.valid("json"));
    return c.json({ data });
  })
  .delete("/:id", requirePermission(PERMISSIONS.CAREER_DELETE), async (c) => {
    await careerService.deleteJob(c.var.db, c.req.param("id"));
    return c.json({ data: { success: true } });
  });
