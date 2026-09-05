import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { PERMISSIONS } from "@nexora/contracts";
import { listUploadsSchema, uploadBase64Schema } from "@nexora/contracts/modules/uploads/uploads.validation";
import { uploadsService } from "@nexora/core";
import type { AppEnv } from "../lib/context";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/rbac";

function r2Storage(c: { env: AppEnv["Bindings"] }) {
  return {
    async put(key: string, bytes: Uint8Array, contentType: string) {
      await c.env.R2_PRIVATE.put(key, bytes, { httpMetadata: { contentType } });
    },
    async delete(key: string) {
      await c.env.R2_PRIVATE.delete(key);
    },
  };
}

export const uploads = new Hono<AppEnv>()
  .get("/", requireAuth, zValidator("query", listUploadsSchema), async (c) => {
    const { page, limit } = c.req.valid("query");
    return c.json(await uploadsService.list(c.var.db, c.var.user!.id, page, limit));
  })
  .post("/", requireAuth, zValidator("json", uploadBase64Schema), async (c) => {
    const data = await uploadsService.upload(
      c.var.db,
      c.var.user!.id,
      c.env.APP_URL,
      c.req.valid("json"),
      r2Storage(c),
    );
    return c.json({ data }, 201);
  })
  .get("/:id/signed-url", requireAuth, async (c) => {
    const data = await uploadsService.getSignedUrl(c.var.db, c.req.param("id"), c.var.user!.id, r2Storage(c));
    return c.json({ data });
  })
  .get("/:id/file", requireAuth, async (c) => {
    const parsed = await uploadsService.getPublicFile(c.var.db, c.req.param("id"));
    const obj = await c.env.R2_PUBLIC.get(parsed.key);
    if (!obj) return c.json({ error: { code: "NOT_FOUND", message: "File not found" } }, 404);
    return new Response(obj.body, { headers: { "Content-Type": parsed.upload.mimeType } });
  })
  .delete("/:id", requirePermission(PERMISSIONS.ADMIN_MANAGE), async (c) => {
    await uploadsService.remove(c.var.db, c.req.param("id"), c.var.user!.id, r2Storage(c));
    return c.json({ data: { success: true } });
  });
