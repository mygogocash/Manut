import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { PERMISSIONS } from "@nexora/contracts";
import {
  createArticleSchema,
  updateArticleSchema,
} from "@nexora/contracts/modules/articles/articles.validation";
import { articlesService } from "@nexora/core";
import type { AppEnv } from "../lib/context";
import { requirePermission } from "../middleware/rbac";

export const articles = new Hono<AppEnv>()
  .get("/", requirePermission(PERMISSIONS.PR_READ), async (c) => {
    const search = c.req.query("search") || undefined;
    const page = Number(c.req.query("page") ?? "1");
    const limit = Number(c.req.query("limit") ?? "20");
    return c.json(await articlesService.list(c.var.db, { search, page, limit }));
  })
  .post("/", requirePermission(PERMISSIONS.PR_CREATE), zValidator("json", createArticleSchema), async (c) => {
    const result = await articlesService.create(c.var.db, c.req.valid("json"), c.var.user!.id);
    return c.json(result, 201);
  })
  .get("/export", requirePermission(PERMISSIONS.PR_READ), async (c) => {
    const search = c.req.query("search") || undefined;
    const csv = await articlesService.exportCsv(c.var.db, { search });
    const day = new Date().toISOString().slice(0, 10);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="pr-articles-${day}.csv"`,
      },
    });
  })
  .get("/:id", requirePermission(PERMISSIONS.PR_READ), async (c) => {
    return c.json(await articlesService.getById(c.var.db, c.req.param("id")));
  })
  .put("/:id", requirePermission(PERMISSIONS.PR_UPDATE), zValidator("json", updateArticleSchema), async (c) => {
    return c.json(await articlesService.update(c.var.db, c.req.param("id"), c.req.valid("json")));
  })
  .delete("/:id", requirePermission(PERMISSIONS.PR_DELETE), async (c) => {
    return c.json(await articlesService.remove(c.var.db, c.req.param("id")));
  });
