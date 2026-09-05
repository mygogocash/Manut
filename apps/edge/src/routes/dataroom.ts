import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { PERMISSIONS } from "@nexora/contracts";
import {
  createDocumentSchema,
  listDocumentsSchema,
  updateDocumentSchema,
} from "@nexora/contracts/modules/dataroom/dataroom.validation";
import { dataroomService } from "@nexora/core";
import type { AppEnv } from "../lib/context";
import { requirePermission } from "../middleware/rbac";

export const dataroom = new Hono<AppEnv>()
  .get("/", requirePermission(PERMISSIONS.DATAROOM_READ), zValidator("query", listDocumentsSchema), async (c) =>
    c.json(await dataroomService.list(c.var.db, c.req.valid("query"))),
  )
  .get("/summary", requirePermission(PERMISSIONS.DATAROOM_READ), async (c) =>
    c.json({ data: await dataroomService.getCategorySummary(c.var.db) }),
  )
  .post("/", requirePermission(PERMISSIONS.DATAROOM_UPLOAD), zValidator("json", createDocumentSchema), async (c) => {
    const data = await dataroomService.upload(c.var.db, c.var.user!.id, c.req.valid("json"));
    return c.json({ data }, 201);
  })
  .get("/:id", requirePermission(PERMISSIONS.DATAROOM_READ), async (c) =>
    c.json({ data: await dataroomService.getById(c.var.db, c.req.param("id")) }),
  )
  .put(
    "/:id",
    requirePermission(PERMISSIONS.DATAROOM_MANAGE),
    zValidator("json", updateDocumentSchema),
    async (c) => c.json({ data: await dataroomService.update(c.var.db, c.req.param("id"), c.req.valid("json")) }),
  )
  .delete("/:id", requirePermission(PERMISSIONS.DATAROOM_MANAGE), async (c) => {
    await dataroomService.remove(c.var.db, c.req.param("id"));
    return c.json({ data: { success: true } });
  });
