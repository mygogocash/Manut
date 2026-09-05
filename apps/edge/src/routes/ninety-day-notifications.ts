import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { PERMISSIONS } from "@nexora/contracts";
import {
  createNinetyDaySchema,
  ninetyDayQuerySchema,
  updateNinetyDaySchema,
} from "@nexora/contracts/modules/ninety-day/ninety-day.validation";
import { ninetyDayService } from "@nexora/core";
import { z } from "zod";
import type { AppEnv } from "../lib/context";
import { requirePermission } from "../middleware/rbac";

const importRowsSchema = z.object({
  rows: z.array(z.record(z.unknown())).min(1, "rows array is required"),
});

export const ninetyDayNotifications = new Hono<AppEnv>()
  .get(
    "/",
    requirePermission(PERMISSIONS.VISA_HR_READ, PERMISSIONS.VISA_MANAGE),
    zValidator("query", ninetyDayQuerySchema),
    async (c) => c.json(await ninetyDayService.list(c.var.db, c.req.valid("query"))),
  )
  .post(
    "/",
    requirePermission(PERMISSIONS.VISA_MANAGE),
    zValidator("json", createNinetyDaySchema),
    async (c) => {
      const data = await ninetyDayService.create(c.var.db, c.req.valid("json"));
      return c.json({ data }, 201);
    },
  )
  .post(
    "/import/preview",
    requirePermission(PERMISSIONS.VISA_MANAGE),
    zValidator("json", importRowsSchema),
    async (c) => {
      const { rows } = c.req.valid("json");
      const data = await ninetyDayService.previewImport(c.var.db, rows);
      return c.json({ data });
    },
  )
  .post(
    "/import/commit",
    requirePermission(PERMISSIONS.VISA_MANAGE),
    zValidator("json", importRowsSchema),
    async (c) => {
      const { rows } = c.req.valid("json");
      const data = await ninetyDayService.commitImport(c.var.db, rows);
      return c.json({ data });
    },
  )
  .get(
    "/:id/receipt/download",
    requirePermission(PERMISSIONS.VISA_HR_READ, PERMISSIONS.VISA_MANAGE),
    async (c) => {
      const data = await ninetyDayService.getReceiptDownloadUrl(c.var.db, c.req.param("id"));
      return c.json({ data });
    },
  )
  .get(
    "/:id",
    requirePermission(PERMISSIONS.VISA_HR_READ, PERMISSIONS.VISA_MANAGE),
    async (c) => c.json({ data: await ninetyDayService.getById(c.var.db, c.req.param("id")) }),
  )
  .put(
    "/:id",
    requirePermission(PERMISSIONS.VISA_MANAGE),
    zValidator("json", updateNinetyDaySchema),
    async (c) => {
      const data = await ninetyDayService.update(c.var.db, c.req.param("id"), c.req.valid("json"));
      return c.json({ data });
    },
  )
  .delete("/:id", requirePermission(PERMISSIONS.VISA_MANAGE), async (c) => {
    const data = await ninetyDayService.remove(c.var.db, c.req.param("id"));
    return c.json({ data });
  });
