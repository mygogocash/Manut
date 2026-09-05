import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { PERMISSIONS } from "@nexora/contracts";
import {
  createBlogSchema,
  updateBlogSchema,
} from "@nexora/contracts/modules/blogs/blogs.validation";
import { blogsService } from "@nexora/core";
import type { AppEnv } from "../lib/context";
import { requirePermission } from "../middleware/rbac";

export const blogs = new Hono<AppEnv>()
  .get("/", requirePermission(PERMISSIONS.BLOG_READ), async (c) => {
    const search = c.req.query("search") || undefined;
    const page = Number(c.req.query("page") ?? "1");
    const limit = Number(c.req.query("limit") ?? "20");
    return c.json(await blogsService.list(c.var.db, { search, page, limit }));
  })
  .post("/", requirePermission(PERMISSIONS.BLOG_CREATE), zValidator("json", createBlogSchema), async (c) => {
    const result = await blogsService.create(c.var.db, c.req.valid("json"), c.var.user!.id);
    return c.json(result, 201);
  })
  .get("/export", requirePermission(PERMISSIONS.BLOG_READ), async (c) => {
    const search = c.req.query("search") || undefined;
    const csv = await blogsService.exportCsv(c.var.db, { search });
    const day = new Date().toISOString().slice(0, 10);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="blogs-${day}.csv"`,
      },
    });
  })
  .get("/:id", requirePermission(PERMISSIONS.BLOG_READ), async (c) => {
    return c.json(await blogsService.getById(c.var.db, c.req.param("id")));
  })
  .put("/:id", requirePermission(PERMISSIONS.BLOG_UPDATE), zValidator("json", updateBlogSchema), async (c) => {
    return c.json(await blogsService.update(c.var.db, c.req.param("id"), c.req.valid("json")));
  })
  .delete("/:id", requirePermission(PERMISSIONS.BLOG_DELETE), async (c) => {
    return c.json(await blogsService.remove(c.var.db, c.req.param("id")));
  });
