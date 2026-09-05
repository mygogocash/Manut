import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { PERMISSIONS } from "@nexora/contracts";
import {
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  createCommentSchema,
  createTicketSchema,
  ticketQuerySchema,
  updateHelpdeskSettingsSchema,
  updateTicketSchema,
} from "@nexora/contracts/modules/helpdesk/helpdesk.validation";
import { helpdeskService } from "@nexora/core";
import type { AppEnv } from "../lib/context";
import { requirePermission } from "../middleware/rbac";

export const helpdesk = new Hono<AppEnv>()
  .get(
    "/options",
    requirePermission(PERMISSIONS.IT_READ, PERMISSIONS.IT_READ_ALL, PERMISSIONS.IT_CREATE),
    (c) =>
      c.json({
        data: {
          categories: TICKET_CATEGORIES,
          priorities: TICKET_PRIORITIES,
          statuses: TICKET_STATUSES,
        },
      }),
  )
  .get(
    "/",
    requirePermission(PERMISSIONS.IT_READ, PERMISSIONS.IT_READ_ALL),
    zValidator("query", ticketQuerySchema),
    async (c) =>
      c.json(
        await helpdeskService.list(c.var.db, c.var.user!.id, c.var.user!.permissions, c.req.valid("query")),
      ),
  )
  .post(
    "/",
    requirePermission(PERMISSIONS.IT_CREATE),
    zValidator("json", createTicketSchema),
    async (c) => {
      const result = await helpdeskService.create(c.var.db, c.req.valid("json"), c.var.user!.id);
      return c.json(result, 201);
    },
  )
  .get(
    "/inbox-count",
    requirePermission(PERMISSIONS.IT_READ, PERMISSIONS.IT_READ_ALL, PERMISSIONS.IT_CREATE),
    async (c) => c.json(await helpdeskService.inboxCount(c.var.db, c.var.user!.id, c.var.user!.permissions)),
  )
  .get("/assignees", requirePermission(PERMISSIONS.IT_ASSIGN), async (c) =>
    c.json(await helpdeskService.listAssignees(c.var.db)),
  )
  .get("/settings", requirePermission(PERMISSIONS.IT_SETTINGS_MANAGE), async (c) =>
    c.json(await helpdeskService.getSettings(c.var.db)),
  )
  .put(
    "/settings",
    requirePermission(PERMISSIONS.IT_SETTINGS_MANAGE),
    zValidator("json", updateHelpdeskSettingsSchema),
    async (c) =>
      c.json(
        await helpdeskService.updateSettings(
          c.var.db,
          c.req.valid("json"),
          c.var.user!.id,
        ),
      ),
  )
  .get("/:id", requirePermission(PERMISSIONS.IT_READ, PERMISSIONS.IT_READ_ALL), async (c) =>
    c.json(await helpdeskService.getById(c.var.db, c.req.param("id"), c.var.user!.id, c.var.user!.permissions)),
  )
  .patch(
    "/:id",
    requirePermission(PERMISSIONS.IT_READ, PERMISSIONS.IT_READ_ALL),
    zValidator("json", updateTicketSchema),
    async (c) =>
      c.json(
        await helpdeskService.update(
          c.var.db,
          c.req.param("id"),
          c.req.valid("json"),
          c.var.user!.id,
          c.var.user!.permissions,
        ),
      ),
  )
  .delete("/:id", requirePermission(PERMISSIONS.IT_READ, PERMISSIONS.IT_DELETE), async (c) =>
    c.json(await helpdeskService.remove(c.var.db, c.req.param("id"), c.var.user!.id, c.var.user!.permissions)),
  )
  .get("/:id/comments", requirePermission(PERMISSIONS.IT_READ, PERMISSIONS.IT_READ_ALL), async (c) =>
    c.json(
      await helpdeskService.listComments(
        c.var.db,
        c.req.param("id"),
        c.var.user!.id,
        c.var.user!.permissions,
      ),
    ),
  )
  .post(
    "/:id/comments",
    requirePermission(PERMISSIONS.IT_READ, PERMISSIONS.IT_READ_ALL),
    zValidator("json", createCommentSchema),
    async (c) =>
      c.json(
        await helpdeskService.addComment(
          c.var.db,
          c.req.param("id"),
          c.req.valid("json"),
          c.var.user!.id,
          c.var.user!.permissions,
        ),
      ),
  );
