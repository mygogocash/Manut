import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { PERMISSIONS } from "@nexora/contracts";
import {
  createCompanyDateSchema,
  updateCompanyDateSchema,
} from "@nexora/contracts/modules/company-dates/company-dates.validation";
import { companyDatesService } from "@nexora/core";
import type { AppEnv } from "../lib/context";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/rbac";

export const companyDates = new Hono<AppEnv>()
  .get("/", requireAuth, async (c) => {
    const page = Math.max(1, Number(c.req.query("page") || 1));
    const limit = Math.min(50, Math.max(1, Number(c.req.query("limit") || 20)));
    return c.json(await companyDatesService.listUpcoming(c.var.db, page, limit));
  })
  .post("/", requirePermission(PERMISSIONS.ADMIN_MANAGE), zValidator("json", createCompanyDateSchema), async (c) => {
    const date = await companyDatesService.create(c.var.db, c.var.user!.id, c.req.valid("json"));
    return c.json({ data: date }, 201);
  })
  .get("/:id", requireAuth, async (c) => {
    const data = await companyDatesService.getById(c.var.db, c.req.param("id"));
    return c.json({ data });
  })
  .put("/:id", requirePermission(PERMISSIONS.ADMIN_MANAGE), zValidator("json", updateCompanyDateSchema), async (c) => {
    const data = await companyDatesService.update(c.var.db, c.req.param("id"), c.req.valid("json"));
    return c.json({ data });
  })
  .delete("/:id", requirePermission(PERMISSIONS.ADMIN_MANAGE), async (c) => {
    await companyDatesService.remove(c.var.db, c.req.param("id"));
    return c.json({ data: { success: true } });
  });
