import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { PERMISSIONS } from "@/common/constants/permissions";
import { errorHandler } from "@/core/middleware/error-handler";
import messagesRoutes from "@/modules/messages/messages.controller";
import { messagesRepository } from "@/modules/messages/messages.repository";

vi.mock("@/modules/messages/messages.repository", () => ({
  directChannelName: (ids: string[]) => `dm:${[...ids].sort().join(":")}`,
  messagesRepository: {
    findAllChannels: vi.fn(),
    findChannelById: vi.fn(),
    createChannel: vi.fn(),
    updateChannel: vi.fn(),
    deleteChannel: vi.fn(),
    findMessages: vi.fn(),
    createMessage: vi.fn(),
    findMessageById: vi.fn(),
    deleteMessage: vi.fn(),
    findDirectChannel: vi.fn(),
    listChannelsForUser: vi.fn(),
    listActiveUsers: vi.fn(),
    findAttachmentsForMessages: vi.fn(),
    markChannelRead: vi.fn(),
    countUnreadByChannel: vi.fn(),
    findChannelReads: vi.fn(),
  },
}));

vi.mock("@/modules/uploads/uploads.repository", () => ({
  uploadsRepository: {
    linkToMessage: vi.fn(),
  },
}));

vi.mock("@/core/guards/auth.guard", () => ({
  authenticate: (
    req: express.Request,
    _res: express.Response,
    next: express.NextFunction,
  ) => {
    const uid = req.header("x-test-user") ?? "u-1";
    req.user = {
      id: uid,
      email: `${uid}@example.com`,
      name: uid,
      isActive: true,
      deletedAt: null,
      entityId: null,
      permissions: [PERMISSIONS.MESSAGES_READ, PERMISSIONS.MESSAGES_CREATE],
    };
    next();
  },
  requirePermission:
    () =>
    (
      _req: express.Request,
      _res: express.Response,
      next: express.NextFunction,
    ) =>
      next(),
}));

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/messages", messagesRoutes);
  app.use(errorHandler);
  return app;
}

describe("messages controller channel authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("denies message history for a DM the user is not a member of", async () => {
    (messagesRepository.findChannelById as Mock).mockResolvedValue({
      id: "ch-dm",
      type: "direct",
      members: [{ userId: "u-2" }, { userId: "u-3" }],
    });

    const res = await request(buildApp())
      .get("/api/messages/channels/ch-dm/messages")
      .set("x-test-user", "u-1");

    expect(res.status).toBe(403);
    expect(messagesRepository.findMessages).not.toHaveBeenCalled();
  });

  it("allows message history for a DM member", async () => {
    (messagesRepository.findChannelById as Mock).mockResolvedValue({
      id: "ch-dm",
      type: "direct",
      members: [{ userId: "u-1" }, { userId: "u-2" }],
    });
    (messagesRepository.findMessages as Mock).mockResolvedValue({
      data: [],
      total: 0,
    });
    (messagesRepository.findAttachmentsForMessages as Mock).mockResolvedValue(
      [],
    );
    (messagesRepository.findChannelReads as Mock).mockResolvedValue([]);

    const res = await request(buildApp())
      .get("/api/messages/channels/ch-dm/messages")
      .set("x-test-user", "u-1");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      data: [],
      meta: { page: 1, limit: 50, total: 0, totalPages: 0 },
    });
  });

  it("denies typing for a private channel non-member", async () => {
    (messagesRepository.findChannelById as Mock).mockResolvedValue({
      id: "ch-private",
      type: "private",
      members: [{ userId: "u-2" }],
    });

    const res = await request(buildApp())
      .post("/api/messages/channels/ch-private/typing")
      .set("x-test-user", "u-1");

    expect(res.status).toBe(403);
  });
});
