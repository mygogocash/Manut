import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { PERMISSIONS } from "@nexora/contracts";
import {
  addCommentSchema,
  createPostSchema,
  reactSchema,
  updatePostSchema,
} from "@nexora/contracts/modules/wall/wall.validation";
import { wallService } from "@nexora/core";
import type { AppEnv } from "../lib/context";
import { requirePermission } from "../middleware/rbac";

export const wall = new Hono<AppEnv>()
  .get("/", requirePermission(PERMISSIONS.HOME_READ, PERMISSIONS.WALL_CREATE), async (c) => {
    const page = Math.max(1, Number(c.req.query("page") || 1));
    const limit = Math.min(50, Math.max(1, Number(c.req.query("limit") || 20)));
    return c.json(await wallService.listPosts(c.var.db, page, limit));
  })
  .post("/", requirePermission(PERMISSIONS.WALL_CREATE), zValidator("json", createPostSchema), async (c) => {
    const post = await wallService.createPost(c.var.db, c.var.user!.id, c.req.valid("json"));
    return c.json({ data: post }, 201);
  })
  .get("/:id", requirePermission(PERMISSIONS.HOME_READ, PERMISSIONS.WALL_CREATE), async (c) => {
    const data = await wallService.getPostById(c.var.db, c.req.param("id"));
    return c.json({ data });
  })
  .put("/:id", requirePermission(PERMISSIONS.WALL_CREATE), zValidator("json", updatePostSchema), async (c) => {
    const data = await wallService.updatePost(c.var.db, c.req.param("id"), c.var.user!.id, c.req.valid("json"));
    return c.json({ data });
  })
  .put("/:id/react", requirePermission(PERMISSIONS.HOME_READ, PERMISSIONS.WALL_CREATE), zValidator("json", reactSchema), async (c) => {
    const post = await wallService.react(c.var.db, c.req.param("id"), c.var.user!.id, c.req.valid("json"));
    return c.json({ data: post });
  })
  .post("/:id/comment", requirePermission(PERMISSIONS.WALL_CREATE), zValidator("json", addCommentSchema), async (c) => {
    const comment = await wallService.addComment(c.var.db, c.req.param("id"), c.var.user!.id, c.req.valid("json"));
    return c.json({ data: comment }, 201);
  })
  .delete("/:id", requirePermission(PERMISSIONS.WALL_DELETE), async (c) => {
    await wallService.deletePost(c.var.db, c.req.param("id"));
    return c.json({ data: { success: true } });
  });
