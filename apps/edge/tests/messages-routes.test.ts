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

const verifyToken = vi.fn(async () => ({
  role: "employee",
  subject: "user-123",
}));

function memoryStore(seed?: {
  channels?: Array<{
    id: string;
    title: string;
    type: string;
    members: Array<{ userId: string }>;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
  }>;
  permissionsByUser?: Record<string, string[]>;
}): MessagesStore {
  const channels = new Map(
    (seed?.channels ?? []).map((channel) => [channel.id, channel]),
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

  return {
    async loadPermissions(userId) {
      return new Set(permissionsByUser[userId] ?? []);
    },
    async listChannelsForUser(userId, options) {
      return [...channels.values()].filter((channel) => {
        const member = channel.members.some((entry) => entry.userId === userId);
        if (channel.type === "direct") return member;
        if (channel.type === "private") {
          return member || Boolean(options.includePrivateChannels);
        }
        return member || Boolean(options.includePrivateChannels);
      });
    },
    async findChannelById(id) {
      return channels.get(id) ?? null;
    },
    async countUnreadByChannel() {
      return {};
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
      testEnv({
        ENABLE_HYPERDRIVE_BOUNDARY: "true",
        HYPERDRIVE_DATABASE: {
          connectionString: "postgresql://edge:local@127.0.0.1:5432/manut",
        } as Hyperdrive,
      }),
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
      testEnv({
        ENABLE_HYPERDRIVE_BOUNDARY: "true",
        HYPERDRIVE_DATABASE: {
          connectionString: "postgresql://edge:local@127.0.0.1:5432/manut",
        } as Hyperdrive,
      }),
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
      testEnv({
        ENABLE_HYPERDRIVE_BOUNDARY: "true",
        HYPERDRIVE_DATABASE: {
          connectionString: "postgresql://edge:local@127.0.0.1:5432/manut",
        } as Hyperdrive,
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
