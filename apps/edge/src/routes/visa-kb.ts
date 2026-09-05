import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { PERMISSIONS } from "@nexora/contracts";
import {
  createVisaArticleSchema,
  updateVisaArticleSchema,
  visaArticleForRecordSchema,
  visaArticleQuerySchema,
} from "@nexora/contracts/modules/visa-kb/visa-kb.validation";
import { visaKbService } from "@nexora/core";
import type { AppEnv } from "../lib/context";
import { requirePermission } from "../middleware/rbac";

export const visaKb = new Hono<AppEnv>()
  .use(requirePermission(PERMISSIONS.VISA_MANAGE))
  .get("/", zValidator("query", visaArticleQuerySchema), async (c) =>
    c.json(await visaKbService.list(c.var.db, c.req.valid("query"))),
  )
  .get("/for-record", zValidator("query", visaArticleForRecordSchema), async (c) => {
    const { country, visaType } = c.req.valid("query");
    const data = await visaKbService.getForRecord(c.var.db, country, visaType);
    return c.json({ data });
  })
  .post("/", zValidator("json", createVisaArticleSchema), async (c) => {
    const data = await visaKbService.create(c.var.db, c.req.valid("json"), c.var.user!.id);
    return c.json({ data }, 201);
  })
  .get("/:id", async (c) => c.json({ data: await visaKbService.getById(c.var.db, c.req.param("id")) }))
  .put("/:id", zValidator("json", updateVisaArticleSchema), async (c) => {
    const data = await visaKbService.update(c.var.db, c.req.param("id"), c.req.valid("json"));
    return c.json({ data });
  })
  .delete("/:id", async (c) => {
    const data = await visaKbService.deactivate(c.var.db, c.req.param("id"));
    return c.json({ data });
  });
