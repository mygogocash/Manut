import { afterEach, describe, expect, it, vi } from "vitest";

import { createEdgeApp } from "../src/index";
import type { MessagesStore } from "../src/messages/store";
import type { RuntimeBindings } from "../src/runtime";

const TEST_TOKEN = "test-token-that-is-long-enough-for-edge-auth";

function testEnv(overrides: Partial<RuntimeBindings> = {}): RuntimeBindings {
  return {
    API_ORIGIN: "https://api.example",
    API_RATE_LIMITER: {
      limit: vi.fn(async () => ({ success: true })),
    },
    ENABLE_HYPERDRIVE_BOUNDARY: "false",
    ...overrides,
  } as RuntimeBindings;
}

function hyperdriveEnv(
  overrides: Partial<RuntimeBindings> = {},
): RuntimeBindings {
  return testEnv({
    ENABLE_HYPERDRIVE_BOUNDARY: "true",
    HYPERDRIVE_DATABASE: {
      connectionString: "postgresql://edge:local@127.0.0.1:5432/manut",
    } as Hyperdrive,
    ...overrides,
  });
}

const verifyToken = vi.fn(async () => ({
  role: "employee",
  subject: "user-123",
}));

type SeedChannel = {
  id: string;
  title: string | null;
  type: string;
  members: Array<{ userId: string; leftAt?: string | null }>;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  directKey?: string | null;
};

function memoryStore(seed?: {
  channels?: SeedChannel[];
  permissionsByUser?: Record<string, string[]>;
  users?: Array<{ id: string; name: string | null; avatarUrl?: string | null }>;
}): MessagesStore {
  const channels = new Map(
    (seed?.channels ?? []).map((channel) => [channel.id, { ...channel }]),
  );
  const messages = new Map<
    string,
    Array<{
      id: string;
      conversationId: string;
      authorId: string;
      content: string | null;
      deletedForEveryoneAt: string | null;
      createdAt: string;
      updatedAt: string;
      author: { id: string; name: string | null };
    }>
  >();
  const permissionsByUser = seed?.permissionsByUser ?? {
    "user-123": ["messages:read", "messages:create", "messages:delete"],
  };
  const users = new Map(
    (
      seed?.users ?? [
        { id: "user-123", name: "Test User", avatarUrl: null },
        { id: "user-456", name: "Other User", avatarUrl: null },
      ]
    ).map((user) => [user.id, user]),
  );

  return {
    async loadPermissions(userId) {
      return new Set(permissionsByUser[userId] ?? []);
    },
    async findUserProfile(userId) {
      const user = users.get(userId);
      return user ? { id: user.id, name: user.name } : null;
    },
    async listActiveUsers(excludeUserId) {
      return [...users.values()]
        .filter((user) => user.id !== excludeUserId)
        .map((user) => ({
          id: user.id,
          name: user.name,
          avatarUrl: user.avatarUrl ?? null,
        }));
    },
    async listChannelsForUser(userId, options) {
      return [...channels.values()].filter((channel) => {
        const membership = channel.members.find(
          (entry) => entry.userId === userId && entry.leftAt == null,
        );
        if (!membership) return false;
        if (channel.type === "direct") return true;
        if (channel.type === "private") {
          return true;
        }
        return membership || Boolean(options.includePrivateChannels);
      });
    },
    async findChannelById(id) {
      return channels.get(id) ?? null;
    },
    async countUnreadByChannel(userId, channelIds) {
      const counts: Record<string, number> = {};
      for (const channelId of channelIds) {
        const rows = messages.get(channelId) ?? [];
        counts[channelId] = rows.filter(
          (row) =>
            row.authorId !== userId && row.deletedForEveryoneAt == null,
        ).length;
      }
      return counts;
    },
    async findMessages(channelId, page, limit) {
      const rows = messages.get(channelId) ?? [];
      const start = (page - 1) * limit;
      return { data: rows.slice(start, start + limit), total: rows.length };
    },
    async createMessage(input) {
      const now = new Date().toISOString();
      const row = {
        id: `msg-${(messages.get(input.channelId)?.length ?? 0) + 1}`,
        conversationId: input.channelId,
        authorId: input.authorId,
        content: input.content,
        deletedForEveryoneAt: null,
        createdAt: now,
        updatedAt: now,
        author: { id: input.authorId, name: "Test User" },
      };
      const existing = messages.get(input.channelId) ?? [];
      existing.push(row);
      messages.set(input.channelId, existing);
      return row;
    },
    async findMessageById(id) {
      for (const rows of messages.values()) {
        const found = rows.find((row) => row.id === id);
        if (found) return found;
      }
      return null;
    },
    async softDeleteMessage(id, deletedBy) {
      for (const [channelId, rows] of messages.entries()) {
        const index = rows.findIndex((row) => row.id === id);
        if (index === -1) continue;
        const current = rows[index];
        if (!current) continue;
        const updated = {
          ...current,
          content: null,
          deletedForEveryoneAt: new Date().toISOString(),
          deletedBy,
        };
        rows[index] = updated;
        messages.set(channelId, rows);
        return updated;
      }
      return null;
    },
    async markChannelRead(userId, channelId) {
      const channel = channels.get(channelId);
      if (!channel) throw new Error("missing channel");
      const now = new Date().toISOString();
      channel.members = channel.members.map((member) =>
        member.userId === userId ? { ...member, leftAt: member.leftAt } : member,
      );
      void userId;
      return { lastReadAt: now };
    },
    async hideConversationForUser(userId, channelId) {
      const channel = channels.get(channelId);
      if (!channel) throw new Error("missing channel");
      const now = new Date().toISOString();
      channel.members = channel.members.map((member) =>
        member.userId === userId ? { ...member, leftAt: now } : member,
      );
    },
    async allMembersHaveLeft(channelId) {
      const channel = channels.get(channelId);
      if (!channel || channel.members.length === 0) return false;
      return channel.members.every((member) => member.leftAt != null);
    },
    async deleteChannel(id) {
      channels.delete(id);
      messages.delete(id);
    },
    async createChannel(input) {
      const now = new Date().toISOString();
      const conversationType =
        input.type === "dm" ? "direct" : input.isPrivate ? "private" : "group";
      const memberIds = Array.from(
        new Set([input.createdBy, ...(input.members ?? [])]),
      );
      const row: SeedChannel = {
        id: `ch-${channels.size + 1}`,
        title: input.name,
        type: conversationType,
        directKey: conversationType === "direct" ? input.name : null,
        members: memberIds.map((userId) => ({
          userId,
          leftAt: null,
        })),
        createdBy: input.createdBy,
        createdAt: now,
        updatedAt: now,
      };
      channels.set(row.id, row);
      return row;
    },
    async updateChannel(id, input) {
      const channel = channels.get(id);
      if (!channel) throw new Error("missing channel");
      if (input.name !== undefined) {
        channel.title = input.name;
      }
      channel.updatedAt = new Date().toISOString();
      return channel;
    },
    async findDirectChannel(memberIds) {
      const key = `dm:${[...memberIds].sort().join(":")}`;
      for (const channel of channels.values()) {
        if (channel.directKey === key) return channel;
      }
      return null;
    },
    async restoreConversationMembership(userId, channelId) {
      const channel = channels.get(channelId);
      if (!channel) throw new Error("missing channel");
      channel.members = channel.members.map((member) =>
        member.userId === userId ? { ...member, leftAt: null } : member,
      );
    },
  };
}

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("messages dual-path routes", () => {
  it("proxies /api/messages/* to Express when Hyperdrive boundary is off", async () => {
    const upstream = vi.fn(async (request: Request) => {
      expect(new URL(request.url).pathname).toBe("/api/messages/channels");
      return Response.json({ data: [{ id: "ch-1", name: "General" }] });
    });
    vi.stubGlobal("fetch", upstream);

    const app = createEdgeApp({ verifyToken });
    const response = await app.request(
      "https://intranet.example/api/messages/channels",
      { headers: { authorization: `Bearer ${TEST_TOKEN}` } },
      testEnv(),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: [{ id: "ch-1", name: "General" }],
    });
    expect(upstream).toHaveBeenCalledOnce();
  });

  it("fails closed for messages when Hyperdrive is flagged on without a binding", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);

    const app = createEdgeApp({ verifyToken });
    const response = await app.request(
      "https://intranet.example/api/messages/channels",
      { headers: { authorization: `Bearer ${TEST_TOKEN}` } },
      testEnv({
        ENABLE_HYPERDRIVE_BOUNDARY: "true",
      }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      code: "HYPERDRIVE_NOT_PROVISIONED",
    });
    expect(upstream).not.toHaveBeenCalled();
  });

  it("serves channel list from Hyperdrive-backed store when boundary is on", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);
    const store = memoryStore({
      channels: [
        {
          id: "ch-1",
          title: "General",
          type: "group",
          members: [{ userId: "user-123" }],
          createdBy: "user-123",
          createdAt: "2026-07-18T00:00:00.000Z",
          updatedAt: "2026-07-18T00:00:00.000Z",
        },
      ],
    });

    const app = createEdgeApp({
      createMessagesStore: async () => store,
      verifyToken,
    });
    const response = await app.request(
      "https://intranet.example/api/messages/channels",
      { headers: { authorization: `Bearer ${TEST_TOKEN}` } },
      hyperdriveEnv(),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: [
        expect.objectContaining({
          id: "ch-1",
          name: "General",
          type: "channel",
        }),
      ],
    });
    expect(upstream).not.toHaveBeenCalled();
  });

  it("denies channel access for non-members on the Hyperdrive path", async () => {
    const store = memoryStore({
      channels: [
        {
          id: "ch-private",
          title: "Private",
          type: "private",
          members: [{ userId: "other-user" }],
          createdBy: "other-user",
          createdAt: "2026-07-18T00:00:00.000Z",
          updatedAt: "2026-07-18T00:00:00.000Z",
        },
      ],
      permissionsByUser: {
        "user-123": ["messages:read"],
      },
    });

    const app = createEdgeApp({
      createMessagesStore: async () => store,
      verifyToken,
    });
    const response = await app.request(
      "https://intranet.example/api/messages/channels/ch-private",
      { headers: { authorization: `Bearer ${TEST_TOKEN}` } },
      hyperdriveEnv(),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      code: "CHANNEL_ACCESS_DENIED",
    });
  });

  it("sends a message on the Hyperdrive path and fans out to the DO room", async () => {
    const store = memoryStore({
      channels: [
        {
          id: "ch-1",
          title: "General",
          type: "group",
          members: [{ userId: "user-123" }],
          createdBy: "user-123",
          createdAt: "2026-07-18T00:00:00.000Z",
          updatedAt: "2026-07-18T00:00:00.000Z",
        },
      ],
    });
    const broadcastFetch = vi.fn(async () =>
      Response.json({ accepted: true }, { status: 202 }),
    );
    const rooms = {
      getByName: vi.fn(() => ({ fetch: broadcastFetch })),
    };

    const app = createEdgeApp({
      createMessagesStore: async () => store,
      verifyToken,
    });
    const response = await app.request(
      "https://intranet.example/api/messages/channels/ch-1/messages",
      {
        body: JSON.stringify({ content: "hello from edge" }),
        headers: {
          authorization: `Bearer ${TEST_TOKEN}`,
          "content-type": "application/json",
        },
        method: "POST",
      },
      hyperdriveEnv({
        REALTIME_ROOMS: rooms as unknown as RuntimeBindings["REALTIME_ROOMS"],
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      data: expect.objectContaining({
        content: "hello from edge",
        channelId: "ch-1",
      }),
    });
    expect(rooms.getByName).toHaveBeenCalledWith("channel:ch-1");
    expect(broadcastFetch).toHaveBeenCalledOnce();
  });

  it("returns unread summary on the Hyperdrive path", async () => {
    const store = memoryStore({
      channels: [
        {
          id: "ch-1",
          title: "General",
          type: "group",
          members: [{ userId: "user-123" }],
          createdBy: "user-123",
          createdAt: "2026-07-18T00:00:00.000Z",
          updatedAt: "2026-07-18T00:00:00.000Z",
        },
      ],
    });
    await store.createMessage({
      channelId: "ch-1",
      authorId: "user-456",
      content: "ping",
    });

    const app = createEdgeApp({
      createMessagesStore: async () => store,
      verifyToken,
    });
    const response = await app.request(
      "https://intranet.example/api/messages/unread-count",
      { headers: { authorization: `Bearer ${TEST_TOKEN}` } },
      hyperdriveEnv(),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: { total: 1 },
    });
  });

  it("marks a channel read on the Hyperdrive path", async () => {
    const store = memoryStore({
      channels: [
        {
          id: "ch-1",
          title: "General",
          type: "group",
          members: [{ userId: "user-123" }],
          createdBy: "user-123",
          createdAt: "2026-07-18T00:00:00.000Z",
          updatedAt: "2026-07-18T00:00:00.000Z",
        },
      ],
    });
    const broadcastFetch = vi.fn(async () =>
      Response.json({ accepted: true }, { status: 202 }),
    );

    const app = createEdgeApp({
      createMessagesStore: async () => store,
      verifyToken,
    });
    const response = await app.request(
      "https://intranet.example/api/messages/channels/ch-1/read",
      {
        headers: { authorization: `Bearer ${TEST_TOKEN}` },
        method: "POST",
      },
      hyperdriveEnv({
        REALTIME_ROOMS: {
          getByName: vi.fn(() => ({ fetch: broadcastFetch })),
        } as unknown as RuntimeBindings["REALTIME_ROOMS"],
      }),
    );

    expect(response.status).toBe(204);
    expect(broadcastFetch).toHaveBeenCalledOnce();
  });

  it("signals typing on the Hyperdrive path with channel access checks", async () => {
    const store = memoryStore({
      channels: [
        {
          id: "ch-1",
          title: "General",
          type: "group",
          members: [{ userId: "user-123" }],
          createdBy: "user-123",
          createdAt: "2026-07-18T00:00:00.000Z",
          updatedAt: "2026-07-18T00:00:00.000Z",
        },
      ],
    });
    const broadcastFetch = vi.fn(async () =>
      Response.json({ accepted: true }, { status: 202 }),
    );

    const app = createEdgeApp({
      createMessagesStore: async () => store,
      verifyToken,
    });
    const response = await app.request(
      "https://intranet.example/api/messages/channels/ch-1/typing",
      {
        headers: { authorization: `Bearer ${TEST_TOKEN}` },
        method: "POST",
      },
      hyperdriveEnv({
        REALTIME_ROOMS: {
          getByName: vi.fn(() => ({ fetch: broadcastFetch })),
        } as unknown as RuntimeBindings["REALTIME_ROOMS"],
      }),
    );

    expect(response.status).toBe(204);
    expect(broadcastFetch).toHaveBeenCalledOnce();
    const [[broadcastRequest]] = broadcastFetch.mock.calls as unknown as [
      [Request],
    ];
    await expect(broadcastRequest.json()).resolves.toMatchObject({
      payload: {
        type: "typing",
        channelId: "ch-1",
        payload: expect.objectContaining({
          userId: "user-123",
          userName: "Test User",
        }),
      },
    });
  });

  it("hides a conversation for the caller on the Hyperdrive path", async () => {
    const store = memoryStore({
      channels: [
        {
          id: "ch-dm",
          title: "dm:user-123:user-456",
          type: "direct",
          members: [
            { userId: "user-123", leftAt: null },
            { userId: "user-456", leftAt: null },
          ],
          createdBy: "user-123",
          createdAt: "2026-07-18T00:00:00.000Z",
          updatedAt: "2026-07-18T00:00:00.000Z",
          directKey: "dm:user-123:user-456",
        },
      ],
    });

    const app = createEdgeApp({
      createMessagesStore: async () => store,
      verifyToken,
    });
    const response = await app.request(
      "https://intranet.example/api/messages/channels/ch-dm/hide",
      {
        headers: { authorization: `Bearer ${TEST_TOKEN}` },
        method: "POST",
      },
      hyperdriveEnv(),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: { hidden: true, hardDeleted: false },
    });
  });

  it("lists messageable users on the Hyperdrive path", async () => {
    const store = memoryStore();
    const app = createEdgeApp({
      createMessagesStore: async () => store,
      verifyToken,
    });
    const response = await app.request(
      "https://intranet.example/api/messages/users",
      { headers: { authorization: `Bearer ${TEST_TOKEN}` } },
      hyperdriveEnv(),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: [{ id: "user-456", name: "Other User", avatarUrl: null }],
    });
  });

  it("creates a DM on the Hyperdrive path", async () => {
    const store = memoryStore();
    const app = createEdgeApp({
      createMessagesStore: async () => store,
      verifyToken,
    });
    const response = await app.request(
      "https://intranet.example/api/messages/dms",
      {
        body: JSON.stringify({ userIds: ["user-456"] }),
        headers: {
          authorization: `Bearer ${TEST_TOKEN}`,
          "content-type": "application/json",
        },
        method: "POST",
      },
      hyperdriveEnv(),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      data: expect.objectContaining({
        type: "dm",
        members: expect.arrayContaining(["user-123", "user-456"]),
      }),
    });
  });

  it("creates a channel on the Hyperdrive path", async () => {
    const store = memoryStore();
    const app = createEdgeApp({
      createMessagesStore: async () => store,
      verifyToken,
    });
    const response = await app.request(
      "https://intranet.example/api/messages/channels",
      {
        body: JSON.stringify({
          name: "Ops",
          isPrivate: false,
          members: ["user-456"],
        }),
        headers: {
          authorization: `Bearer ${TEST_TOKEN}`,
          "content-type": "application/json",
        },
        method: "POST",
      },
      hyperdriveEnv(),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      data: expect.objectContaining({
        name: "Ops",
        type: "channel",
      }),
    });
  });

  it("updates and deletes channels for messages admins on the Hyperdrive path", async () => {
    const store = memoryStore({
      channels: [
        {
          id: "ch-1",
          title: "General",
          type: "group",
          members: [{ userId: "user-123" }],
          createdBy: "user-123",
          createdAt: "2026-07-18T00:00:00.000Z",
          updatedAt: "2026-07-18T00:00:00.000Z",
        },
      ],
      permissionsByUser: {
        "user-123": [
          "messages:read",
          "messages:create",
          "messages:delete",
          "messages:admin",
        ],
      },
    });
    const app = createEdgeApp({
      createMessagesStore: async () => store,
      verifyToken,
    });

    const updated = await app.request(
      "https://intranet.example/api/messages/channels/ch-1",
      {
        body: JSON.stringify({ name: "Renamed" }),
        headers: {
          authorization: `Bearer ${TEST_TOKEN}`,
          "content-type": "application/json",
        },
        method: "PUT",
      },
      hyperdriveEnv(),
    );
    expect(updated.status).toBe(200);
    await expect(updated.json()).resolves.toMatchObject({
      data: expect.objectContaining({ name: "Renamed" }),
    });

    const deleted = await app.request(
      "https://intranet.example/api/messages/channels/ch-1",
      {
        headers: { authorization: `Bearer ${TEST_TOKEN}` },
        method: "DELETE",
      },
      hyperdriveEnv(),
    );
    expect(deleted.status).toBe(200);
    await expect(deleted.json()).resolves.toEqual({
      data: { success: true },
    });
  });

  it("keeps unported attachment-upload linking on Express even when Hyperdrive is on", async () => {
    const upstream = vi.fn(async (request: Request) => {
      expect(new URL(request.url).pathname).toBe(
        "/api/messages/channels/ch-1/messages",
      );
      return Response.json({ data: { id: "msg-proxy" } }, { status: 201 });
    });
    vi.stubGlobal("fetch", upstream);

    const store = memoryStore({
      channels: [
        {
          id: "ch-1",
          title: "General",
          type: "group",
          members: [{ userId: "user-123" }],
          createdBy: "user-123",
          createdAt: "2026-07-18T00:00:00.000Z",
          updatedAt: "2026-07-18T00:00:00.000Z",
        },
      ],
    });
    const app = createEdgeApp({
      createMessagesStore: async () => store,
      verifyToken,
    });
    const response = await app.request(
      "https://intranet.example/api/messages/channels/ch-1/messages",
      {
        body: JSON.stringify({
          content: "",
          attachmentIds: ["11111111-1111-1111-1111-111111111111"],
        }),
        headers: {
          authorization: `Bearer ${TEST_TOKEN}`,
          "content-type": "application/json",
        },
        method: "POST",
      },
      hyperdriveEnv(),
    );

    expect(response.status).toBe(201);
    expect(upstream).toHaveBeenCalledOnce();
  });

  it("requires authentication before messages proxy or Hyperdrive handling", async () => {
    const app = createEdgeApp({ verifyToken });
    const response = await app.request(
      "https://intranet.example/api/messages/channels",
      {},
      testEnv(),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      code: "AUTHENTICATION_REQUIRED",
    });
  });
});
