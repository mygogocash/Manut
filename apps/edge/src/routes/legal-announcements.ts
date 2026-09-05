import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { PERMISSIONS } from "@nexora/contracts";
import { announcementQuerySchema } from "@nexora/contracts/modules/legal-announcements/legal-announcements.validation";
import { legalAnnouncementsService } from "@nexora/core";
import type { AppEnv } from "../lib/context";
import { requirePermission } from "../middleware/rbac";

export const legalAnnouncements = new Hono<AppEnv>()
  .get("/", requirePermission(PERMISSIONS.LEGAL_ANNOUNCEMENT_READ), zValidator("query", announcementQuerySchema), async (c) =>
    c.json(await legalAnnouncementsService.list(c.var.db, c.var.user!.id, c.var.user!.permissions, c.req.valid("query"))),
  )
  .get("/:id", requirePermission(PERMISSIONS.LEGAL_ANNOUNCEMENT_READ), async (c) =>
    c.json({ data: await legalAnnouncementsService.getById(c.var.db, c.req.param("id")) }),
  );
