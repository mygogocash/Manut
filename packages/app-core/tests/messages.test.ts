import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../src/api/api-client";
import {
  applyChannelMessageEvent,
  buildMessagesSocketNamespaceUrl,
  channelMessagesQueryKey,
  listChannelMessages,
  listMessageChannels,
  messageChannelSchema,
  messageChannelsQueryKey,
  parseMessagesLiveEvent,
  sendChannelMessage,
  sendChannelMessageInputSchema,
} from "../src/messages/messages";
import {
  REALTIME_DO_CHAT_GAP,
  buildRealtimeRoomPath,
  buildRealtimeRoomWebSocketUrl,
  isRealtimeRoomId,
  parseRealtimeServerMessage,
} from "../src/messages/realtime-room";

const channel = {
  id: "ch-1",
  name: "General",
  description: "Company updates",
  isPrivate: false,
  type: "channel",
  members: null,
  createdBy: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-02T00:00:00.000Z",
  creator: { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", name: "Ada" },
  _count: { messages: 12 },
  unreadCount: 3,
};

const message = {
  id: "msg-1",
  channelId: "ch-1",
  authorId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  content: "Hello team",
  isDeleted: false,
  createdAt: "2026-07-02T12:00:00.000Z",
  author: {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    name: "Ada",
    avatarUrl: "https://cdn.example/avatar.png",
    email: "ada@example.com",
  },
  attachments: [],
  readBy: [],
};

describe("messages foundation contracts", () => {
  it("projects channel list fields for a read-only inbox", () => {
    const parsed = messageChannelSchema.parse(channel);
    expect(parsed).toEqual({
      id: "ch-1",
      name: "General",
      description: "Company updates",
      isPrivate: false,
      type: "channel",
      unreadCount: 3,
      messageCount: 12,
      updatedAt: "2026-07-02T00:00:00.000Z",
    });
    expect(parsed).not.toHaveProperty("members");
    expect(parsed).not.toHaveProperty("createdBy");
  });

  it("lists channels via REST", async () => {
    const signal = { aborted: false };
    const get = vi.fn().mockResolvedValue({ data: [channel] });
    const client = { get } as unknown as ApiClient;

    await expect(listMessageChannels(client, signal)).resolves.toEqual({
      data: [
        expect.objectContaining({
          id: "ch-1",
          name: "General",
          unreadCount: 3,
          messageCount: 12,
        }),
      ],
    });
    expect(get).toHaveBeenCalledWith("/messages/channels", { signal });
    expect(messageChannelsQueryKey()).toEqual(["messages", "channels"]);
  });

  it("lists channel message history and strips author PII extras", async () => {
    const signal = { aborted: false };
    const get = vi.fn().mockResolvedValue({
      data: [message],
      meta: { page: 1, limit: 50, total: 1, totalPages: 1 },
    });
    const client = { get } as unknown as ApiClient;

    const result = await listChannelMessages(
      client,
      "ch-1",
      { page: 1, limit: 50 },
      signal,
    );
    expect(result.data[0]).toEqual({
      id: "msg-1",
      channelId: "ch-1",
      content: "Hello team",
      isDeleted: false,
      createdAt: "2026-07-02T12:00:00.000Z",
      authorName: "Ada",
      authorId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    });
    expect(result.data[0]).not.toHaveProperty("email");
    expect(result.data[0]).not.toHaveProperty("avatarUrl");
    expect(get).toHaveBeenCalledWith(
      "/messages/channels/ch-1/messages?page=1&limit=50",
      { signal },
    );
    expect(channelMessagesQueryKey("ch-1")).toEqual([
      "messages",
      "channel-messages",
      "ch-1",
      { page: 1, limit: 50 },
    ]);
  });

  it("sends a channel message via REST", async () => {
    const post = vi.fn().mockResolvedValue({ data: message });
    const client = { post } as unknown as ApiClient;

    await expect(
      sendChannelMessage(client, "ch-1", { content: "Hello team" }),
    ).resolves.toEqual(
      expect.objectContaining({
        id: "msg-1",
        content: "Hello team",
        authorName: "Ada",
      }),
    );
    expect(post).toHaveBeenCalledWith("/messages/channels/ch-1/messages", {
      content: "Hello team",
    });
    expect(() =>
      sendChannelMessageInputSchema.parse({ content: "   " }),
    ).toThrow();
  });

  it("applies live message.created and message.deleted events with dedupe", () => {
    const existing = [
      {
        id: "msg-1",
        channelId: "ch-1",
        content: "Hello team",
        isDeleted: false,
        createdAt: "2026-07-02T12:00:00.000Z",
        authorName: "Ada",
        authorId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      },
    ];
    const created = parseMessagesLiveEvent({
      type: "message.created",
      channelId: "ch-1",
      payload: {
        ...message,
        id: "msg-2",
        content: "Second",
        createdAt: "2026-07-02T12:01:00.000Z",
      },
    });
    expect(created).not.toBeNull();
    const afterCreate = applyChannelMessageEvent(existing, created!);
    expect(afterCreate).toHaveLength(2);
    expect(afterCreate[1]?.content).toBe("Second");
    expect(applyChannelMessageEvent(afterCreate, created!)).toHaveLength(2);

    const deleted = parseMessagesLiveEvent({
      type: "message.deleted",
      channelId: "ch-1",
      payload: { ...message, isDeleted: true, content: "" },
    });
    expect(deleted).not.toBeNull();
    const afterDelete = applyChannelMessageEvent(afterCreate, deleted!);
    expect(afterDelete.find((m) => m.id === "msg-1")?.isDeleted).toBe(true);
  });

  it("builds the API socket.io namespace URL for shared-channel live events", () => {
    expect(buildMessagesSocketNamespaceUrl("https://api.example.invalid/api")).toBe(
      "https://api.example.invalid/messages",
    );
    expect(buildMessagesSocketNamespaceUrl("https://api.example.invalid")).toBe(
      "https://api.example.invalid/messages",
    );
    expect(buildMessagesSocketNamespaceUrl("/api")).toBe("/messages");
  });

  it("documents the remaining DO shared-room gap and builds room URLs", () => {
    expect(REALTIME_DO_CHAT_GAP).toMatch(/principal-scoped/i);
    expect(REALTIME_DO_CHAT_GAP).toMatch(/socket\.io/i);
    expect(isRealtimeRoomId("channel-1")).toBe(true);
    expect(isRealtimeRoomId("bad id")).toBe(false);
    expect(buildRealtimeRoomPath("channel-1")).toBe(
      "/api/v1/realtime/rooms/channel-1",
    );
    expect(
      buildRealtimeRoomWebSocketUrl("https://intranet.example", "channel-1"),
    ).toBe("wss://intranet.example/api/v1/realtime/rooms/channel-1");
    expect(parseRealtimeServerMessage('{"type":"ready","connectionId":"c1"}')).toEqual(
      expect.objectContaining({ type: "ready", connectionId: "c1" }),
    );
  });
});
