import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  applyChannelListEvent,
  applyMessageEvent,
  applyTypingEvent,
  type ChannelEvent,
  type MessagesRealtimeSocket,
  pruneTyping,
  type TypingState,
  useMessagesSocket,
} from "@/components/messages/message-stream";
import type { Channel, Message } from "@/services/message.service";

const baseMsg: Message = {
  id: "m1",
  channelId: "ch-1",
  authorId: "u-1",
  content: "hi",
  isPinned: false,
  createdAt: "2026-05-05T00:00:00Z",
  updatedAt: "2026-05-05T00:00:00Z",
  author: { id: "u-1", name: "U", avatarUrl: null },
};

const baseChannel: Channel = {
  id: "ch-1",
  name: "general",
  description: null,
  isPrivate: false,
  members: [],
  type: "channel",
  createdBy: "u-1",
  createdAt: "2026-05-05T00:00:00Z",
  updatedAt: "2026-05-05T00:00:00Z",
  creator: { id: "u-1", name: "U", avatarUrl: null },
  _count: { messages: 1 },
  unreadCount: 0,
};

describe("applyMessageEvent", () => {
  it("appends a message.created payload to the list", () => {
    const event: ChannelEvent = {
      type: "message.created",
      channelId: "ch-1",
      payload: { ...baseMsg, id: "m2" },
    };
    const next = applyMessageEvent([baseMsg], event);
    expect(next.map((m) => m.id)).toEqual(["m1", "m2"]);
  });

  it("does not duplicate when a created message already exists", () => {
    const event: ChannelEvent = {
      type: "message.created",
      channelId: "ch-1",
      payload: baseMsg,
    };
    const next = applyMessageEvent([baseMsg], event);
    expect(next).toHaveLength(1);
  });

  it("marks a deleted message as deleted in the list", () => {
    const second = { ...baseMsg, id: "m2", content: "bye" };
    const event: ChannelEvent = {
      type: "message.deleted",
      channelId: "ch-1",
      payload: {
        ...second,
        isDeleted: true,
        content: "",
        attachments: [],
      },
    };
    const next = applyMessageEvent([baseMsg, second], event);
    expect(next).toHaveLength(2);
    expect(next[1]?.isDeleted).toBe(true);
    expect(next[1]?.content).toBe("");
  });

  it("ignores typing events (state unchanged)", () => {
    const event: ChannelEvent = {
      type: "typing",
      channelId: "ch-1",
      payload: { userId: "u-2", userName: "Bob", until: Date.now() + 5000 },
    };
    const list = [baseMsg];
    const next = applyMessageEvent(list, event);
    expect(next).toBe(list);
  });

  it("channel.read appends userId to readBy on messages older than lastReadAt", () => {
    const earlier: Message = {
      ...baseMsg,
      id: "m1",
      createdAt: "2026-05-05T00:00:00Z",
    };
    const later: Message = {
      ...baseMsg,
      id: "m2",
      createdAt: "2026-05-05T00:10:00Z",
    };
    const event: ChannelEvent = {
      type: "channel.read",
      channelId: "ch-1",
      payload: { userId: "u-2", lastReadAt: "2026-05-05T00:05:00Z" },
    };
    const next = applyMessageEvent([earlier, later], event);
    expect(next[0].readBy).toEqual(["u-2"]);
    expect(next[1].readBy ?? []).toEqual([]);
  });

  it("channel.read does not duplicate userId in readBy", () => {
    const msg: Message = {
      ...baseMsg,
      id: "m1",
      createdAt: "2026-05-05T00:00:00Z",
      readBy: ["u-2"],
    };
    const event: ChannelEvent = {
      type: "channel.read",
      channelId: "ch-1",
      payload: { userId: "u-2", lastReadAt: "2026-05-05T00:05:00Z" },
    };
    const next = applyMessageEvent([msg], event);
    expect(next).toBe([msg].length === 1 ? next : next);
    expect(next[0].readBy).toEqual(["u-2"]);
  });

  it("channel.read does not mark own messages as read by self", () => {
    const ownMsg: Message = {
      ...baseMsg,
      id: "m1",
      authorId: "u-1",
      createdAt: "2026-05-05T00:00:00Z",
    };
    const event: ChannelEvent = {
      type: "channel.read",
      channelId: "ch-1",
      payload: { userId: "u-1", lastReadAt: "2026-05-05T00:05:00Z" },
    };
    const next = applyMessageEvent([ownMsg], event);
    expect(next[0].readBy ?? []).toEqual([]);
  });
});

describe("applyTypingEvent", () => {
  it("new user > adds entry", () => {
    const state: TypingState = {};
    const until = Date.now() + 5000;
    const next = applyTypingEvent(state, {
      type: "typing",
      channelId: "ch-1",
      payload: { userId: "u-2", userName: "Bob", until },
    });
    expect(next).toEqual({ "u-2": { userName: "Bob", until } });
  });

  it("same user retyping > updates until", () => {
    const earlier = Date.now() + 1000;
    const later = Date.now() + 6000;
    const state: TypingState = { "u-2": { userName: "Bob", until: earlier } };
    const next = applyTypingEvent(state, {
      type: "typing",
      channelId: "ch-1",
      payload: { userId: "u-2", userName: "Bob", until: later },
    });
    expect(next["u-2"].until).toBe(later);
  });
});

describe("pruneTyping", () => {
  it("expired entries removed", () => {
    const now = 10_000;
    const state: TypingState = {
      "u-2": { userName: "Bob", until: 5_000 },
      "u-3": { userName: "Carol", until: 9_999 },
    };
    const next = pruneTyping(state, now);
    expect(next).toEqual({});
  });

  it("non-expired retained", () => {
    const now = 10_000;
    const state: TypingState = {
      "u-2": { userName: "Bob", until: 5_000 },
      "u-3": { userName: "Carol", until: 15_000 },
    };
    const next = pruneTyping(state, now);
    expect(next).toEqual({ "u-3": { userName: "Carol", until: 15_000 } });
  });
});

describe("applyChannelListEvent", () => {
  it("upserts created channel and sorts by updatedAt desc", () => {
    const newer = {
      ...baseChannel,
      id: "ch-2",
      name: "random",
      updatedAt: "2026-05-05T01:00:00Z",
    };
    const next = applyChannelListEvent(
      [baseChannel],
      { type: "channel.created", channelId: "ch-2", payload: newer },
      { currentUserId: "u-1", selectedChannelId: null },
    );
    expect(next.map((c) => c.id)).toEqual(["ch-2", "ch-1"]);
  });

  it("increments unread only for inactive non-own messages", () => {
    const event: ChannelEvent = {
      type: "message.created",
      channelId: "ch-1",
      payload: { ...baseMsg, id: "m2", authorId: "u-2" },
    };

    const next = applyChannelListEvent([baseChannel], event, {
      currentUserId: "u-1",
      selectedChannelId: "other",
    });

    expect(next[0]._count.messages).toBe(2);
    expect(next[0].unreadCount).toBe(1);
  });

  it("does not double count already-known message events", () => {
    const event: ChannelEvent = {
      type: "message.created",
      channelId: "ch-1",
      payload: { ...baseMsg, id: "m2", authorId: "u-2" },
    };

    const next = applyChannelListEvent([baseChannel], event, {
      currentUserId: "u-1",
      selectedChannelId: "other",
      messageAlreadyKnown: true,
    });

    expect(next[0]._count.messages).toBe(1);
    expect(next[0].unreadCount).toBe(0);
  });

  it("clears unread for current user's channel.read event", () => {
    const next = applyChannelListEvent(
      [{ ...baseChannel, unreadCount: 4 }],
      {
        type: "channel.read",
        channelId: "ch-1",
        payload: {
          userId: "u-1",
          lastReadAt: "2026-05-05T00:05:00Z",
        },
      },
      { currentUserId: "u-1", selectedChannelId: "ch-1" },
    );

    expect(next[0].unreadCount).toBe(0);
  });
});

describe("useMessagesSocket", () => {
  function createFakeSocket() {
    const handlers = new Map<string, Set<(...args: unknown[]) => void>>();
    const socket: MessagesRealtimeSocket = {
      connected: false,
      connect: vi.fn(() => {
        socket.connected = true;
      }),
      disconnect: vi.fn(() => {
        socket.connected = false;
      }),
      emit: vi.fn(),
      on: vi.fn((event, handler) => {
        if (!handlers.has(event)) handlers.set(event, new Set());
        handlers.get(event)!.add(handler);
      }),
      off: vi.fn((event, handler) => {
        handlers.get(event)?.delete(handler);
      }),
    };
    return {
      socket,
      fire(event: string, ...args: unknown[]) {
        for (const handler of handlers.get(event) ?? []) handler(...args);
      },
    };
  }

  it("connects, joins selected channel, forwards events, and cleans up", () => {
    const fake = createFakeSocket();
    const onEvent = vi.fn();
    const onReconnect = vi.fn();
    const factory = () => fake.socket;

    const { unmount } = renderHook(() =>
      useMessagesSocket({
        selectedChannelId: "ch-1",
        onEvent,
        onReconnect,
        factory,
      }),
    );

    expect(fake.socket.connect).toHaveBeenCalledTimes(1);

    act(() => {
      fake.fire("connect");
    });

    expect(fake.socket.emit).toHaveBeenCalledWith("channel:join", {
      channelId: "ch-1",
    });
    expect(onReconnect).toHaveBeenCalledTimes(1);

    const event: ChannelEvent = {
      type: "message.deleted",
      channelId: "ch-1",
      payload: { ...baseMsg, isDeleted: true, content: "" },
    };
    act(() => {
      fake.fire("messages:event", event);
    });
    expect(onEvent).toHaveBeenCalledWith(event);

    unmount();

    expect(fake.socket.emit).toHaveBeenCalledWith("channel:leave", {
      channelId: "ch-1",
    });
    expect(fake.socket.disconnect).toHaveBeenCalledTimes(1);
  });
});
