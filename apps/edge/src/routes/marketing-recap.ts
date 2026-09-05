import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { PERMISSIONS } from "@nexora/contracts";
import {
  recapDateSchema,
  recapNotesSchema,
  recapTargetsSchema,
} from "@nexora/contracts/modules/marketing-recap/marketing-recap.validation";
import { marketingRecapService } from "@nexora/core";
import type { AppEnv } from "../lib/context";
import { requirePermission } from "../middleware/rbac";

export const marketingRecap = new Hono<AppEnv>()
  .get("/targets", requirePermission(PERMISSIONS.MARKETING_DASHBOARD_VIEW), async (c) =>
    c.json({ data: await marketingRecapService.getTargets(c.var.db) }),
  )
  .put("/targets", requirePermission(PERMISSIONS.MARKETING_DASHBOARD_VIEW), zValidator("json", recapTargetsSchema), async (c) =>
    c.json({ data: await marketingRecapService.setTargets(c.var.db, c.req.valid("json")) }),
  )
  .get("/notes/:date", requirePermission(PERMISSIONS.MARKETING_DASHBOARD_VIEW), async (c) => {
    const date = recapDateSchema.parse(c.req.param("date"));
    return c.json({ data: await marketingRecapService.getNotes(c.var.db, date) });
  })
  .put("/notes/:date", requirePermission(PERMISSIONS.MARKETING_DASHBOARD_VIEW), zValidator("json", recapNotesSchema), async (c) =>
    c.json({ data: await marketingRecapService.setNotes(c.var.db, c.req.param("date"), c.req.valid("json")) }),
  );
