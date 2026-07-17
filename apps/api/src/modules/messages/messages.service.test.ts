import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { PERMISSIONS } from "@/common/constants/permissions";
import { BadRequestException } from "@/common/exceptions/http-exception";
import { messageBus } from "@/modules/messages/messages.bus";
import { messagesRepository } from "@/modules/messages/messages.repository";
import { messagesService } from "@/modules/messages/messages.service";
import { uploadsRepository } from "@/modules/uploads/uploads.repository";
import { arrayAt, mockArgument } from "@/test-utils/assertions";

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
    softDeleteMessage: vi.fn(),
    hideConversationForUser: vi.fn(),
    allMembersHaveLeft: vi.fn(),
    restoreConversationMembership: vi.fn(),
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

const UID_A = "11111111-1111-1111-1111-111111111111";
const UID_B = "22222222-2222-2222-2222-222222222222";
const UID_C = "33333333-3333-3333-3333-333333333333";

describe("messagesService.createDirectMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("given new 1:1 pair > creates dm channel with type=dm and both members", async () => {
    (messagesRepository.findDirectChannel as Mock).mockResolvedValue(null);
    (messagesRepository.createChannel as Mock).mockImplementation(
      async (data: Record<string, unknown>) => ({
        id: "ch-new",
        title: data.name,
        type: "direct",
        createdBy: data.createdBy,
        members: ((data.members as string[]) ?? []).map((id: string) => ({
          userId: id,
        })),
      }),
    );

    const result = await messagesService.createDirectMessage(UID_A, [UID_B]);

    expect(messagesRepository.findDirectChannel).toHaveBeenCalledWith([
      UID_A,
      UID_B,
    ]);
    expect(messagesRepository.createChannel).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "dm",
        isPrivate: true,
        members: expect.arrayContaining([UID_A, UID_B]),
        createdBy: UID_A,
      }),
    );
    expect(result.type).toBe("dm");
  });

  it("given existing pair > returns existing channel without creating", async () => {
    const existing = {
      id: "ch-existing",
      type: "direct",
      members: [{ userId: UID_A }, { userId: UID_B }],
      createdBy: UID_A,
    };
    (messagesRepository.findDirectChannel as Mock).mockResolvedValue(existing);
    (messagesRepository.findChannelById as Mock).mockResolvedValue(existing);

    const result = await messagesService.createDirectMessage(UID_A, [UID_B]);

    expect(messagesRepository.createChannel).not.toHaveBeenCalled();
    expect(
      messagesRepository.restoreConversationMembership,
    ).toHaveBeenCalledWith(UID_A, "ch-existing");
    expect(result.id).toBe("ch-existing");
    expect(result.type).toBe("dm");
    expect(result.members).toEqual([UID_A, UID_B]);
  });

  it("given self in others > rejects with BadRequestException", async () => {
    await expect(
      messagesService.createDirectMessage(UID_A, [UID_A]),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(messagesRepository.findDirectChannel).not.toHaveBeenCalled();
  });

  it("given empty others > rejects with BadRequestException", async () => {
    await expect(
      messagesService.createDirectMessage(UID_A, []),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("given group of 2 others > creates dm with 3 members deterministic", async () => {
    (messagesRepository.findDirectChannel as Mock).mockResolvedValue(null);
    (messagesRepository.createChannel as Mock).mockImplementation(
      async (data: Record<string, unknown>) => ({
        id: "ch-grp",
        title: data.name,
        type: "direct",
        createdBy: data.createdBy,
        members: ((data.members as string[]) ?? []).map((id: string) => ({
          userId: id,
        })),
      }),
    );

    const result = await messagesService.createDirectMessage(UID_A, [
      UID_C,
      UID_B,
    ]);

    expect(messagesRepository.findDirectChannel).toHaveBeenCalledWith([
      UID_A,
      UID_B,
      UID_C,
    ]);
    const args = mockArgument(
      (messagesRepository.createChannel as Mock).mock.calls,
      0,
      0,
    );
    expect(args.members).toEqual(expect.arrayContaining([UID_A, UID_B, UID_C]));
    expect(result.type).toBe("dm");
  });

  it("given duplicates in others > deduplicates before lookup", async () => {
    (messagesRepository.findDirectChannel as Mock).mockResolvedValue(null);
    (messagesRepository.createChannel as Mock).mockResolvedValue({
      id: "ch-dedup",
      type: "direct",
      members: [{ userId: UID_A }, { userId: UID_B }],
      createdBy: UID_A,
    });

    await messagesService.createDirectMessage(UID_A, [UID_B, UID_B]);

    expect(messagesRepository.findDirectChannel).toHaveBeenCalledWith([
      UID_A,
      UID_B,
    ]);
  });
});

describe("messagesService.sendMessage with attachments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    messageBus.reset();
  });

  it("links provided attachmentIds to the new message", async () => {
    (messagesRepository.findChannelById as Mock).mockResolvedValue({
      id: "ch-1",
    });
    (messagesRepository.createMessage as Mock).mockResolvedValue({
      id: "m-new",
      conversationId: "ch-1",
      content: "see file",
    });
    (uploadsRepository.linkToMessage as Mock).mockResolvedValue([
      { id: "att-1", url: "/x.pdf" },
    ]);

    const result = await messagesService.sendMessage("ch-1", UID_A, {
      content: "see file",
      attachmentIds: ["att-1"],
    });

    expect(uploadsRepository.linkToMessage).toHaveBeenCalledWith(
      ["att-1"],
      "m-new",
      UID_A,
    );
    expect(result.attachments).toEqual([{ id: "att-1", url: "/x.pdf" }]);
  });

  it("returns attachments=[] when no attachmentIds passed", async () => {
    (messagesRepository.findChannelById as Mock).mockResolvedValue({
      id: "ch-1",
    });
    (messagesRepository.createMessage as Mock).mockResolvedValue({
      id: "m-new",
      conversationId: "ch-1",
    });

    const result = await messagesService.sendMessage("ch-1", UID_A, {
      content: "hi",
    });

    expect(uploadsRepository.linkToMessage).not.toHaveBeenCalled();
    expect(result.attachments).toEqual([]);
  });
});

describe("messagesService.listMessages enriches with attachments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("attaches FileUpload rows to each message keyed by linkedId", async () => {
    (messagesRepository.findChannelById as Mock).mockResolvedValue({
      id: "ch-1",
    });
    const messages = [
      { id: "m1", conversationId: "ch-1" },
      { id: "m2", conversationId: "ch-1" },
    ];
    (messagesRepository.findMessages as Mock).mockResolvedValue({
      data: messages,
      total: 2,
    });
    (messagesRepository.findAttachmentsForMessages as Mock).mockResolvedValue([
      { id: "a1", linkedId: "m1", url: "/a1.png" },
      { id: "a2", linkedId: "m2", url: "/a2.pdf" },
      { id: "a3", linkedId: "m1", url: "/a3.png" },
    ]);

    const result = await messagesService.listMessages("ch-1", 1, 50);

    expect(messagesRepository.findAttachmentsForMessages).toHaveBeenCalledWith([
      "m1",
      "m2",
    ]);
    expect(arrayAt(result.data, 0, "first message").attachments).toEqual([
      { id: "a1", linkedId: "m1", url: "/a1.png" },
      { id: "a3", linkedId: "m1", url: "/a3.png" },
    ]);
    expect(arrayAt(result.data, 1, "second message").attachments).toEqual([
      { id: "a2", linkedId: "m2", url: "/a2.pdf" },
    ]);
  });
});

describe("messagesService publish hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    messageBus.reset();
  });

  it("sendMessage publishes message.created event to the channel", async () => {
    const channel = { id: "ch-1", type: "channel" };
    (messagesRepository.findChannelById as Mock).mockResolvedValue(channel);
    const created = { id: "m1", conversationId: "ch-1", content: "hi" };
    (messagesRepository.createMessage as Mock).mockResolvedValue(created);

    const handler = vi.fn();
    messageBus.subscribe("ch-1", handler);

    await messagesService.sendMessage("ch-1", UID_A, { content: "hi" });

    expect(handler).toHaveBeenCalledTimes(1);
    const event = mockArgument(handler.mock.calls, 0, 0);
    expect(event.type).toBe("message.created");
    expect(event.channelId).toBe("ch-1");
    expect(event.payload.id).toBe("m1");
    expect(event.payload.channelId).toBe("ch-1");
    expect(event.payload.content).toBe("hi");
    expect(event.payload.attachments).toEqual([]);
  });

  it("deleteMessage soft-deletes and publishes message.deleted with payload", async () => {
    const message = {
      id: "m1",
      conversationId: "ch-1",
      authorId: UID_A,
      content: "hello",
      createdAt: new Date(),
      updatedAt: new Date(),
      author: { id: UID_A, name: "A", avatarUrl: null },
    };
    const softDeleted = {
      ...message,
      deletedForEveryoneAt: new Date(),
      deletedBy: UID_A,
      content: null,
    };
    (messagesRepository.findMessageById as Mock).mockResolvedValue(message);
    (messagesRepository.findChannelById as Mock).mockResolvedValue({
      id: "ch-1",
      type: "direct",
      members: [{ userId: UID_A }, { userId: UID_B }],
    });
    (messagesRepository.softDeleteMessage as Mock).mockResolvedValue(
      softDeleted,
    );

    const handler = vi.fn();
    messageBus.subscribe("ch-1", handler);

    await messagesService.deleteMessage("m1", {
      id: UID_A,
      permissions: [PERMISSIONS.MESSAGES_DELETE],
    });

    expect(messagesRepository.softDeleteMessage).toHaveBeenCalledWith(
      "m1",
      UID_A,
    );
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "message.deleted",
        channelId: "ch-1",
        payload: expect.objectContaining({
          id: "m1",
          isDeleted: true,
          content: "",
        }),
      }),
    );
  });

  it("hideConversation hard-deletes when all members have left", async () => {
    const channel = {
      id: "ch-dm",
      type: "direct",
      title: "dm:a:b",
      members: [{ userId: UID_A }, { userId: UID_B }],
      createdBy: UID_A,
    };
    (messagesRepository.findChannelById as Mock).mockResolvedValue(channel);
    (messagesRepository.hideConversationForUser as Mock).mockResolvedValue({});
    (messagesRepository.allMembersHaveLeft as Mock).mockResolvedValue(true);
    (messagesRepository.deleteChannel as Mock).mockResolvedValue(channel);

    const handler = vi.fn();
    messageBus.subscribeAll(handler);

    const result = await messagesService.hideConversation("ch-dm", UID_A, {
      id: UID_A,
      permissions: [PERMISSIONS.MESSAGES_READ],
    });

    expect(result.data.hardDeleted).toBe(true);
    expect(messagesRepository.deleteChannel).toHaveBeenCalledWith("ch-dm");
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ type: "channel.deleted", channelId: "ch-dm" }),
    );
  });

  it("createChannel publishes channel.created", async () => {
    const channel = {
      id: "ch-new",
      title: "general",
      type: "group",
      members: [],
      createdBy: UID_A,
    };
    (messagesRepository.createChannel as Mock).mockResolvedValue(channel);

    const handler = vi.fn();
    messageBus.subscribeAll(handler);

    await messagesService.createChannel(UID_A, {
      name: "general",
      isPrivate: false,
    });

    expect(handler).toHaveBeenCalledTimes(1);
    const event = mockArgument(handler.mock.calls, 0, 0);
    expect(event.type).toBe("channel.created");
    expect(event.channelId).toBe("ch-new");
    expect(event.payload.name).toBe("general");
    expect(event.payload.type).toBe("channel");
  });

  it("updateChannel publishes channel.updated", async () => {
    const existing = {
      id: "ch-1",
      title: "old",
      type: "group",
      members: [],
      createdBy: UID_A,
    };
    const updated = { ...existing, title: "new" };
    (messagesRepository.findChannelById as Mock).mockResolvedValue(existing);
    (messagesRepository.updateChannel as Mock).mockResolvedValue(updated);

    const handler = vi.fn();
    messageBus.subscribeAll(handler);

    await messagesService.updateChannel("ch-1", { name: "new" });

    expect(handler).toHaveBeenCalledTimes(1);
    const event = mockArgument(handler.mock.calls, 0, 0);
    expect(event.type).toBe("channel.updated");
    expect(event.channelId).toBe("ch-1");
    expect(event.payload.name).toBe("new");
  });

  it("deleteChannel publishes channel.deleted with previous channel", async () => {
    const channel = {
      id: "ch-1",
      title: "old",
      type: "group",
      members: [],
      createdBy: UID_A,
    };
    (messagesRepository.findChannelById as Mock).mockResolvedValue(channel);
    (messagesRepository.deleteChannel as Mock).mockResolvedValue(channel);

    const handler = vi.fn();
    messageBus.subscribeAll(handler);

    await messagesService.deleteChannel("ch-1");

    expect(handler).toHaveBeenCalledTimes(1);
    const event = mockArgument(handler.mock.calls, 0, 0);
    expect(event.type).toBe("channel.deleted");
    expect(event.channelId).toBe("ch-1");
    expect(event.payload.name).toBe("old");
  });
});

describe("messagesService.listMessageableUsers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns active users excluding the caller", async () => {
    const repoUsers = [
      { id: UID_A, name: "Alice", avatarUrl: null },
      { id: UID_B, name: "Bob", avatarUrl: null },
    ];
    (messagesRepository.listActiveUsers as Mock).mockResolvedValue(repoUsers);

    const result = await messagesService.listMessageableUsers(UID_A);

    expect(messagesRepository.listActiveUsers).toHaveBeenCalledWith(UID_A);
    expect(result.data).toEqual([{ id: UID_B, name: "Bob", avatarUrl: null }]);
  });
});

describe("messagesService.listChannels", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("filters channels via listChannelsForUser when userId provided", async () => {
    const channels = [
      {
        id: "c1",
        type: "group",
        title: "general",
        members: [],
        createdBy: UID_A,
      },
    ];
    (messagesRepository.listChannelsForUser as Mock).mockResolvedValue(
      channels,
    );
    (messagesRepository.countUnreadByChannel as Mock).mockResolvedValue({});

    const result = await messagesService.listChannels(UID_A);

    expect(messagesRepository.listChannelsForUser).toHaveBeenCalledWith(UID_A, {
      includePrivateChannels: false,
    });
    expect(messagesRepository.findAllChannels).not.toHaveBeenCalled();
    const channel = arrayAt(result.data, 0, "listed channel");
    expect(channel.id).toBe("c1");
    expect(channel.name).toBe("general");
    expect(channel.type).toBe("channel");
  });

  it("enriches channels with unreadCount per channel for the user", async () => {
    const channels = [
      {
        id: "c1",
        type: "group",
        title: "general",
        members: [],
        createdBy: UID_A,
      },
      {
        id: "c2",
        type: "group",
        title: "random",
        members: [],
        createdBy: UID_A,
      },
    ];
    (messagesRepository.listChannelsForUser as Mock).mockResolvedValue(
      channels,
    );
    (messagesRepository.countUnreadByChannel as Mock).mockResolvedValue({
      c1: 3,
      c2: 0,
    });

    const result = await messagesService.listChannels(UID_A);

    expect(messagesRepository.countUnreadByChannel).toHaveBeenCalledWith(
      UID_A,
      ["c1", "c2"],
    );
    expect(
      (result.data[0] as unknown as { unreadCount: number }).unreadCount,
    ).toBe(3);
    expect(
      (result.data[1] as unknown as { unreadCount: number }).unreadCount,
    ).toBe(0);
  });

  it("admin users include private channels in channel list lookup", async () => {
    (messagesRepository.listChannelsForUser as Mock).mockResolvedValue([]);

    await messagesService.listChannels({
      id: UID_A,
      permissions: [PERMISSIONS.MESSAGES_READ, PERMISSIONS.MESSAGES_ADMIN],
    });

    expect(messagesRepository.listChannelsForUser).toHaveBeenCalledWith(UID_A, {
      includePrivateChannels: true,
    });
  });
});

describe("messagesService.markChannelRead", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    messageBus.reset();
  });

  it("upserts channel-read row for the user", async () => {
    (messagesRepository.findChannelById as Mock).mockResolvedValue({
      id: "ch-1",
    });
    (messagesRepository.markChannelRead as Mock).mockResolvedValue({
      userId: UID_A,
      channelId: "ch-1",
      lastReadAt: new Date("2026-05-05T00:00:00Z"),
    });

    await messagesService.markChannelRead(UID_A, "ch-1");

    expect(messagesRepository.markChannelRead).toHaveBeenCalledWith(
      UID_A,
      "ch-1",
    );
  });

  it("publishes channel.read event with userId and lastReadAt", async () => {
    const lastReadAt = new Date("2026-05-05T00:00:00Z");
    (messagesRepository.findChannelById as Mock).mockResolvedValue({
      id: "ch-1",
    });
    (messagesRepository.markChannelRead as Mock).mockResolvedValue({
      userId: UID_A,
      channelId: "ch-1",
      lastReadAt,
    });
    const handler = vi.fn();
    messageBus.subscribe("ch-1", handler);

    await messagesService.markChannelRead(UID_A, "ch-1");

    expect(handler).toHaveBeenCalledWith({
      type: "channel.read",
      channelId: "ch-1",
      payload: { userId: UID_A, lastReadAt: lastReadAt.toISOString() },
    });
  });
});

describe("messagesService.listMessages enriches with readBy for DM channels", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("includes readBy[] of users whose lastReadAt >= msg.createdAt (DM)", async () => {
    (messagesRepository.findChannelById as Mock).mockResolvedValue({
      id: "ch-dm",
      type: "direct",
      members: [{ userId: UID_A }, { userId: UID_B }],
    });
    (messagesRepository.findMessages as Mock).mockResolvedValue({
      data: [
        {
          id: "m1",
          conversationId: "ch-dm",
          authorId: UID_A,
          createdAt: new Date("2026-05-05T00:00:00Z"),
        },
        {
          id: "m2",
          conversationId: "ch-dm",
          authorId: UID_A,
          createdAt: new Date("2026-05-05T00:05:00Z"),
        },
      ],
      total: 2,
    });
    (messagesRepository.findAttachmentsForMessages as Mock).mockResolvedValue(
      [],
    );
    (messagesRepository.findChannelReads as Mock).mockResolvedValue([
      { userId: UID_B, lastReadAt: new Date("2026-05-05T00:03:00Z") },
    ]);

    const result = await messagesService.listMessages("ch-dm", 1, 50);

    expect(arrayAt(result.data, 0, "first direct message").readBy).toEqual([
      UID_B,
    ]);
    expect(arrayAt(result.data, 1, "second direct message").readBy).toEqual([]);
  });

  it("returns empty readBy[] for non-dm channels", async () => {
    (messagesRepository.findChannelById as Mock).mockResolvedValue({
      id: "ch-public",
      type: "group",
    });
    (messagesRepository.findMessages as Mock).mockResolvedValue({
      data: [
        {
          id: "m1",
          conversationId: "ch-public",
          authorId: UID_A,
          createdAt: new Date("2026-05-05T00:00:00Z"),
        },
      ],
      total: 1,
    });
    (messagesRepository.findAttachmentsForMessages as Mock).mockResolvedValue(
      [],
    );

    const result = await messagesService.listMessages("ch-public", 1, 50);

    expect(messagesRepository.findChannelReads).not.toHaveBeenCalled();
    expect(arrayAt(result.data, 0, "public channel message").readBy).toEqual(
      [],
    );
  });
});

describe("messagesService.signalTyping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    messageBus.reset();
  });

  it("publishes typing event with until ~ now + 5000", async () => {
    const handler = vi.fn();
    messageBus.subscribe("ch-1", handler);

    const before = Date.now();
    await messagesService.signalTyping("ch-1", {
      userId: UID_A,
      userName: "Alice",
    });
    const after = Date.now();

    expect(handler).toHaveBeenCalledTimes(1);
    const event = mockArgument(handler.mock.calls, 0, 0);
    expect(event.type).toBe("typing");
    expect(event.channelId).toBe("ch-1");
    expect(event.payload.userId).toBe(UID_A);
    expect(event.payload.userName).toBe("Alice");
    expect(event.payload.until).toBeGreaterThanOrEqual(before + 5000);
    expect(event.payload.until).toBeLessThanOrEqual(after + 5000 + 100);
  });
});
