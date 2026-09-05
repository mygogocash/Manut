import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { PERMISSIONS } from "@nexora/contracts";
import {
  createLostReasonSchema,
  listLostReasonsSchema,
  updateLostReasonSchema,
} from "@nexora/contracts/modules/lost-reasons/lost-reasons.validation";
import { lostReasonsService } from "@nexora/core";
import type { AppEnv } from "../lib/context";
import { requirePermission } from "../middleware/rbac";

export const lostReasons = new Hono<AppEnv>()
  .get("/", requirePermission(PERMISSIONS.CRM_READ), zValidator("query", listLostReasonsSchema), async (c) =>
    c.json({ data: await lostReasonsService.list(c.var.db, c.req.valid("query")) }),
  )
  .post(
    "/",
    requirePermission(PERMISSIONS.CRM_ADMIN),
    zValidator("json", createLostReasonSchema),
    async (c) => {
      const data = await lostReasonsService.create(c.var.db, c.req.valid("json"));
      return c.json({ data }, 201);
    },
  )
  .put(
    "/:id",
    requirePermission(PERMISSIONS.CRM_ADMIN),
    zValidator("json", updateLostReasonSchema),
    async (c) =>
      c.json({ data: await lostReasonsService.update(c.var.db, c.req.param("id"), c.req.valid("json")) }),
  )
  .delete("/:id", requirePermission(PERMISSIONS.CRM_ADMIN), async (c) => {
    await lostReasonsService.remove(c.var.db, c.req.param("id"));
    return c.json({ data: { success: true } });
  });
