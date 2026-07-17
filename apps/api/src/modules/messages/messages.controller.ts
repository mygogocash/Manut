import { Router } from "express";

import { PERMISSIONS } from "@/common/constants/permissions";
import { getRequiredParam } from "@/common/utils/params";
import { authenticate, requirePermission } from "@/core/guards/auth.guard";
import { asyncHandler } from "@/core/middleware/async-handler";
import { messagesService } from "@/modules/messages/messages.service";
import {
  createChannelSchema,
  createDmSchema,
  sendMessageSchema,
  updateChannelSchema,
} from "@/modules/messages/messages.validation";

const router = Router();

router.get(
  "/channels",
  authenticate,
  requirePermission(PERMISSIONS.MESSAGES_READ),
  asyncHandler(async (req, res) => {
    const result = await messagesService.listChannels(req.user!);
    res.json(result);
  }),
);

// Total-unread badge for the sidebar nav. Cheap aggregate over the
// channels the caller can see; safe to poll from every dashboard load.
router.get(
  "/unread-count",
  authenticate,
  requirePermission(PERMISSIONS.MESSAGES_READ),
  asyncHandler(async (req, res) => {
    const result = await messagesService.getUnreadSummary(req.user!);
    res.json(result);
  }),
);

router.post(
  "/dms",
  authenticate,
  requirePermission(PERMISSIONS.MESSAGES_CREATE),
  asyncHandler(async (req, res) => {
    const input = createDmSchema.parse(req.body);
    const channel = await messagesService.createDirectMessage(
      req.user!.id,
      input.userIds,
    );
    res.status(201).json({ data: channel });
  }),
);

router.get(
  "/users",
  authenticate,
  requirePermission(PERMISSIONS.MESSAGES_CREATE),
  asyncHandler(async (req, res) => {
    const result = await messagesService.listMessageableUsers(req.user!.id);
    res.json(result);
  }),
);

router.post(
  "/channels",
  authenticate,
  requirePermission(PERMISSIONS.MESSAGES_CREATE),
  asyncHandler(async (req, res) => {
    const input = createChannelSchema.parse(req.body);
    const channel = await messagesService.createChannel(req.user!.id, input);
    res.status(201).json({ data: channel });
  }),
);

router.get(
  "/channels/:id",
  authenticate,
  requirePermission(PERMISSIONS.MESSAGES_READ),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const result = await messagesService.getChannel(id, req.user!);
    res.json(result);
  }),
);

router.put(
  "/channels/:id",
  authenticate,
  requirePermission(PERMISSIONS.MESSAGES_ADMIN),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const input = updateChannelSchema.parse(req.body);
    const result = await messagesService.updateChannel(id, input);
    res.json(result);
  }),
);

router.delete(
  "/channels/:id",
  authenticate,
  requirePermission(PERMISSIONS.MESSAGES_ADMIN),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    await messagesService.deleteChannel(id);
    res.json({ data: { success: true } });
  }),
);

router.post(
  "/channels/:id/hide",
  authenticate,
  requirePermission(PERMISSIONS.MESSAGES_READ),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const result = await messagesService.hideConversation(
      id,
      req.user!.id,
      req.user!,
    );
    res.json(result);
  }),
);

router.get(
  "/channels/:id/messages",
  authenticate,
  requirePermission(PERMISSIONS.MESSAGES_READ),
  asyncHandler(async (req, res) => {
    const channelId = getRequiredParam(req.params, "id");
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const result = await messagesService.listMessages(
      channelId,
      page,
      limit,
      req.user!,
    );
    res.json(result);
  }),
);

router.post(
  "/channels/:id/messages",
  authenticate,
  requirePermission(PERMISSIONS.MESSAGES_CREATE),
  asyncHandler(async (req, res) => {
    const channelId = getRequiredParam(req.params, "id");
    const input = sendMessageSchema.parse(req.body);
    const message = await messagesService.sendMessage(
      channelId,
      req.user!.id,
      input,
      req.user!,
    );
    res.status(201).json({ data: message });
  }),
);

router.delete(
  "/channels/:channelId/messages/:messageId",
  authenticate,
  requirePermission(PERMISSIONS.MESSAGES_DELETE),
  asyncHandler(async (req, res) => {
    const messageId = getRequiredParam(req.params, "messageId");
    const channelId = getRequiredParam(req.params, "channelId");
    const message = await messagesService.deleteMessage(
      messageId,
      req.user!,
      channelId,
    );
    res.json({ data: message });
  }),
);

router.post(
  "/channels/:id/read",
  authenticate,
  requirePermission(PERMISSIONS.MESSAGES_READ),
  asyncHandler(async (req, res) => {
    const channelId = getRequiredParam(req.params, "id");
    await messagesService.markChannelRead(req.user!.id, channelId, req.user!);
    res.status(204).end();
  }),
);

router.post(
  "/channels/:id/typing",
  authenticate,
  requirePermission(PERMISSIONS.MESSAGES_CREATE),
  asyncHandler(async (req, res) => {
    const channelId = getRequiredParam(req.params, "id");
    await messagesService.signalTyping(channelId, {
      userId: req.user!.id,
      userName: req.user!.name,
      permissions: req.user!.permissions,
    });
    res.status(204).end();
  }),
);

export default router;
