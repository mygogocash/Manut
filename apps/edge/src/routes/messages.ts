import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { PERMISSIONS } from "@nexora/contracts";
import {
  createChannelSchema,
  createDmSchema,
  sendMessageSchema,
  updateChannelSchema,
} from "@nexora/contracts/modules/messages/messages.validation";
import { messagesService } from "@nexora/core";
import type { AppEnv } from "../lib/context";
import { requirePermission } from "../middleware/rbac";

const actor = (c: { var: AppEnv["Variables"] }) => ({
  id: c.var.user!.id,
  permissions: c.var.user!.permissions,
});

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const messages = new Hono<AppEnv>()
  .get("/channels", requirePermission(PERMISSIONS.MESSAGES_READ), async (c) =>
    c.json(await messagesService.listChannels(c.var.db, actor(c))),
  )
  .get("/unread-count", requirePermission(PERMISSIONS.MESSAGES_READ), async (c) =>
    c.json(await messagesService.getUnreadSummary(c.var.db, actor(c))),
  )
  .post("/dms", requirePermission(PERMISSIONS.MESSAGES_CREATE), zValidator("json", createDmSchema), async (c) => {
    const channel = await messagesService.createDirectMessage(c.var.db, c.var.user!.id, c.req.valid("json").userIds);
    return c.json({ data: channel }, 201);
  })
  .get("/users", requirePermission(PERMISSIONS.MESSAGES_CREATE), async (c) =>
    c.json(await messagesService.listMessageableUsers(c.var.db, c.var.user!.id)),
  )
  .post("/channels", requirePermission(PERMISSIONS.MESSAGES_CREATE), zValidator("json", createChannelSchema), async (c) => {
    const channel = await messagesService.createChannel(c.var.db, c.var.user!.id, c.req.valid("json"));
    return c.json({ data: channel }, 201);
  })
  .get("/channels/:id", requirePermission(PERMISSIONS.MESSAGES_READ), async (c) =>
    c.json(await messagesService.getChannel(c.var.db, c.req.param("id"), actor(c))),
  )
  .put("/channels/:id", requirePermission(PERMISSIONS.MESSAGES_ADMIN), zValidator("json", updateChannelSchema), async (c) =>
    c.json(await messagesService.updateChannel(c.var.db, c.req.param("id"), c.req.valid("json"))),
  )
  .delete("/channels/:id", requirePermission(PERMISSIONS.MESSAGES_ADMIN), async (c) => {
    await messagesService.deleteChannel(c.var.db, c.req.param("id"));
    return c.json({ data: { success: true } });
  })
  .post("/channels/:id/hide", requirePermission(PERMISSIONS.MESSAGES_READ), async (c) => {
    await messagesService.hideConversation(c.var.db, c.req.param("id"), c.var.user!.id, actor(c));
    return c.json({ data: { success: true } });
  })
  .post("/channels/:id/read", requirePermission(PERMISSIONS.MESSAGES_READ), async (c) => {
    await messagesService.markChannelRead(c.var.db, c.var.user!.id, c.req.param("id"), actor(c));
    return c.json({ data: { success: true } });
  })
  .get("/channels/:id/messages", requirePermission(PERMISSIONS.MESSAGES_READ), zValidator("query", paginationSchema), async (c) => {
    const { page, limit } = c.req.valid("query");
    return c.json(await messagesService.listMessages(c.var.db, c.req.param("id"), page, limit, actor(c)));
  })
  .post("/channels/:id/messages", requirePermission(PERMISSIONS.MESSAGES_CREATE), zValidator("json", sendMessageSchema), async (c) => {
    const msg = await messagesService.sendMessage(c.var.db, c.req.param("id"), c.var.user!.id, c.req.valid("json"), actor(c));
    return c.json({ data: msg }, 201);
  })
  .delete("/messages/:id", requirePermission(PERMISSIONS.MESSAGES_DELETE), async (c) => {
    await messagesService.deleteMessage(c.var.db, c.req.param("id"), actor(c));
    return c.json({ data: { success: true } });
  })
  .post("/channels/:id/typing", requirePermission(PERMISSIONS.MESSAGES_READ), async (c) => {
    await messagesService.signalTyping(c.var.db, c.req.param("id"), {
      userId: c.var.user!.id,
      userName: c.var.user!.name,
      permissions: c.var.user!.permissions,
    });
    return c.json({ data: { success: true } });
  });
