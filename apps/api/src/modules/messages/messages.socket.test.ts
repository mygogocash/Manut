import { createServer, type Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";

import {
  io as createClient,
  type Socket as ClientSocket,
} from "socket.io-client";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from "vitest";

import { PERMISSIONS } from "@/common/constants/permissions";
import {
  messageBus,
  type MessageBusEvent,
} from "@/modules/messages/messages.bus";
import { messagesRepository } from "@/modules/messages/messages.repository";
import { messagesService } from "@/modules/messages/messages.service";
import { registerMessagesSocket } from "@/modules/messages/messages.socket";

vi.mock("@/modules/messages/messages.repository", () => ({
  messagesRepository: {
    findChannelById: vi.fn(),
    findUserAuthorizationById: vi.fn(),
  },
}));

vi.mock("@/modules/messages/messages.service", () => ({
  messagesService: {
    sendMessage: vi.fn(),
    deleteMessage: vi.fn(),
    signalTyping: vi.fn(),
  },
}));

interface UserState {
  isActive: boolean;
  deletedAt: Date | null;
}

const channels = new Map<string, unknown>();
const permissions = new Map<string, string[]>();
const userStates = new Map<string, UserState>();
let httpServer: HttpServer | null = null;
let clients: ClientSocket[] = [];
let ioServer: ReturnType<typeof registerMessagesSocket> | null = null;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function authorizationUser(userId: string) {
  const state = userStates.get(userId) ?? {
    isActive: true,
    deletedAt: null,
  };
  return {
    id: userId,
    email: `${userId}@example.com`,
    name: userId,
    isActive: state.isActive,
    deletedAt: state.deletedAt,
    entityId: null,
  };
}

async function startServer() {
  httpServer = createServer();
  ioServer = registerMessagesSocket(httpServer, {
    async resolveUserFromToken(token) {
      if (!token) throw new Error("Unauthorized");
      return { ...authorizationUser(token), permissions: [] };
    },
    async loadPermissionsForUser(userId) {
      return new Set(permissions.get(userId) ?? [PERMISSIONS.MESSAGES_READ]);
    },
  });

  await new Promise<void>((resolve) => {
    httpServer!.listen(0, "127.0.0.1", resolve);
  });

  const port = (httpServer.address() as AddressInfo).port;
  return `http://127.0.0.1:${port}/messages`;
}

async function connect(url: string, token?: string) {
  const client = createClient(url, {
    path: "/socket.io/",
    transports: ["websocket"],
    auth: token ? { token } : undefined,
    forceNew: true,
    reconnection: false,
  });
  clients.push(client);

  await new Promise<void>((resolve, reject) => {
    client.once("connect", () => resolve());
    client.once("connect_error", reject);
  });

  return client;
}

function nextMessageEvent(client: ClientSocket) {
  return new Promise<MessageBusEvent>((resolve) => {
    client.once("messages:event", (event) => resolve(event as MessageBusEvent));
  });
}

async function joinChannel(client: ClientSocket, channelId: string) {
  return new Promise<unknown>((resolve) => {
    client.emit("channel:join", { channelId }, resolve);
  });
}

function emitWithAck(
  client: ClientSocket,
  event: "message:send" | "message:delete" | "typing",
  payload: Record<string, unknown>,
) {
  return new Promise<unknown>((resolve) => {
    client.emit(event, payload, resolve);
  });
}

function waitForDisconnect(client: ClientSocket, timeoutMs = 300) {
  return Promise.race([
    new Promise<boolean>((resolve) => {
      client.once("disconnect", () => resolve(true));
    }),
    delay(timeoutMs).then(() => false),
  ]);
}

const lifecycleRevocations = [
  {
    lifecycle: "soft-deleted",
    state: { isActive: true, deletedAt: new Date("2026-07-17T00:00:00Z") },
  },
  {
    lifecycle: "deactivated",
    state: { isActive: false, deletedAt: null },
  },
] as const;

const privilegedEventCases = [
  {
    eventName: "message:send",
    serviceMethod: "sendMessage",
    payload: { channelId: "ch-1", content: "must not send" },
  },
  {
    eventName: "message:delete",
    serviceMethod: "deleteMessage",
    payload: { channelId: "ch-1", messageId: "m-1" },
  },
  {
    eventName: "typing",
    serviceMethod: "signalTyping",
    payload: { channelId: "ch-1" },
  },
] as const;

const lifecycleEventCases = lifecycleRevocations.flatMap((revocation) =>
  privilegedEventCases.map((eventCase) => ({ ...revocation, ...eventCase })),
);

describe("messages socket", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    messageBus.reset();
    clients = [];
    channels.clear();
    permissions.clear();
    userStates.clear();
    (messagesRepository.findChannelById as Mock).mockImplementation(
      async (channelId: string) => channels.get(channelId) ?? null,
    );
    (messagesRepository.findUserAuthorizationById as Mock).mockImplementation(
      async (userId: string) => authorizationUser(userId),
    );
  });

  afterEach(async () => {
    for (const client of clients) client.disconnect();
    await new Promise<void>((resolve) => {
      if (!ioServer) {
        resolve();
        return;
      }
      ioServer.close(() => resolve());
    });
    ioServer = null;
    httpServer = null;
  });

  it("rejects missing auth", async () => {
    const url = await startServer();
    const client = createClient(url, {
      path: "/socket.io/",
      transports: ["websocket"],
      forceNew: true,
      reconnection: false,
    });
    clients.push(client);

    const message = await new Promise<string>((resolve) => {
      client.once("connect_error", (err) => resolve(err.message));
    });

    expect(message).toBe("Unauthorized");
  });

  it("valid users can join authorized channel rooms", async () => {
    channels.set("ch-1", {
      id: "ch-1",
      type: "group",
      members: [],
    });

    const url = await startServer();
    const client = await connect(url, "u-1");

    await expect(joinChannel(client, "ch-1")).resolves.toEqual({ ok: true });
  });

  it("rejects room joins for unauthorized DMs", async () => {
    channels.set("ch-dm", {
      id: "ch-dm",
      type: "direct",
      members: [{ userId: "u-2" }, { userId: "u-3" }],
    });

    const url = await startServer();
    const client = await connect(url, "u-1");

    await expect(joinChannel(client, "ch-dm")).resolves.toMatchObject({
      ok: false,
    });
  });

  it("broadcasts REST-published message events once to authorized clients", async () => {
    channels.set("ch-1", {
      id: "ch-1",
      type: "group",
      members: [],
    });

    const url = await startServer();
    const client = await connect(url, "u-1");
    const received = nextMessageEvent(client);

    messageBus.publish({
      type: "message.created",
      channelId: "ch-1",
      payload: { id: "m1", channelId: "ch-1", content: "hi" },
    });

    await expect(received).resolves.toMatchObject({
      type: "message.created",
      channelId: "ch-1",
    });
  });

  it("does not broadcast DM events to non-members", async () => {
    channels.set("ch-dm", {
      id: "ch-dm",
      type: "direct",
      members: [{ userId: "u-2" }, { userId: "u-3" }],
    });

    const url = await startServer();
    const client = await connect(url, "u-1");
    const handler = vi.fn();
    client.on("messages:event", handler);

    messageBus.publish({
      type: "message.created",
      channelId: "ch-dm",
      payload: { id: "m1", channelId: "ch-dm", content: "secret" },
    });
    await delay(80);

    expect(handler).not.toHaveBeenCalled();
  });

  it("broadcasts typing only to joined channel room clients", async () => {
    channels.set("ch-1", {
      id: "ch-1",
      type: "group",
      members: [],
    });

    const url = await startServer();
    const joined = await connect(url, "u-1");
    const notJoined = await connect(url, "u-2");
    const joinedEvent = nextMessageEvent(joined);
    const otherHandler = vi.fn();
    notJoined.on("messages:event", otherHandler);

    await joinChannel(joined, "ch-1");
    messageBus.publish({
      type: "typing",
      channelId: "ch-1",
      payload: { userId: "u-2", userName: "U2", until: Date.now() + 5000 },
    });

    await expect(joinedEvent).resolves.toMatchObject({ type: "typing" });
    await delay(80);
    expect(otherHandler).not.toHaveBeenCalled();
  });

  it.each(lifecycleRevocations)(
    "disconnects and suppresses passive broadcasts after a user is $lifecycle",
    async ({ state }) => {
      channels.set("ch-1", {
        id: "ch-1",
        type: "group",
        members: [],
      });

      const url = await startServer();
      const client = await connect(url, "u-1");
      const handler = vi.fn();
      client.on("messages:event", handler);
      userStates.set("u-1", state);
      const disconnected = waitForDisconnect(client);

      messageBus.publish({
        type: "message.created",
        channelId: "ch-1",
        payload: { id: "m-1", channelId: "ch-1", content: "secret" },
      });

      await expect(disconnected).resolves.toBe(true);
      await delay(30);
      expect(handler).not.toHaveBeenCalled();
    },
  );

  it.each(lifecycleEventCases)(
    "disconnects before $eventName after a user is $lifecycle",
    async ({ state, eventName, serviceMethod, payload }) => {
      permissions.set("u-1", [
        PERMISSIONS.MESSAGES_READ,
        PERMISSIONS.MESSAGES_CREATE,
        PERMISSIONS.MESSAGES_DELETE,
        PERMISSIONS.MESSAGES_ADMIN,
      ]);
      const url = await startServer();
      const client = await connect(url, "u-1");
      userStates.set("u-1", state);
      const disconnected = waitForDisconnect(client);

      client.emit(eventName, payload);

      await expect(disconnected).resolves.toBe(true);
      expect(messagesService[serviceMethod]).not.toHaveBeenCalled();
    },
  );

  it("disconnects and suppresses passive broadcasts after messages:read is revoked", async () => {
    channels.set("ch-1", {
      id: "ch-1",
      type: "group",
      members: [],
    });
    permissions.set("u-1", [PERMISSIONS.MESSAGES_READ]);
    const url = await startServer();
    const client = await connect(url, "u-1");
    const handler = vi.fn();
    client.on("messages:event", handler);
    permissions.set("u-1", []);
    const disconnected = waitForDisconnect(client);

    messageBus.publish({
      type: "message.created",
      channelId: "ch-1",
      payload: { id: "m-1", channelId: "ch-1", content: "secret" },
    });

    await expect(disconnected).resolves.toBe(true);
    await delay(30);
    expect(handler).not.toHaveBeenCalled();
  });

  it("disconnects before an inbound mutation after messages:read is revoked", async () => {
    permissions.set("u-1", [
      PERMISSIONS.MESSAGES_READ,
      PERMISSIONS.MESSAGES_CREATE,
    ]);
    const url = await startServer();
    const client = await connect(url, "u-1");
    permissions.set("u-1", [PERMISSIONS.MESSAGES_CREATE]);
    const disconnected = waitForDisconnect(client);

    client.emit("message:send", {
      channelId: "ch-1",
      content: "must not send",
    });

    await expect(disconnected).resolves.toBe(true);
    expect(messagesService.sendMessage).not.toHaveBeenCalled();
  });

  it("denies send and typing after messages:create is revoked", async () => {
    permissions.set("u-1", [
      PERMISSIONS.MESSAGES_READ,
      PERMISSIONS.MESSAGES_CREATE,
    ]);
    const url = await startServer();
    const client = await connect(url, "u-1");
    permissions.set("u-1", [PERMISSIONS.MESSAGES_READ]);

    await expect(
      emitWithAck(client, "message:send", {
        channelId: "ch-1",
        content: "must not send",
      }),
    ).resolves.toEqual({ ok: false, error: "Permission denied" });
    await expect(
      emitWithAck(client, "typing", { channelId: "ch-1" }),
    ).resolves.toEqual({ ok: false, error: "Permission denied" });

    expect(messagesService.sendMessage).not.toHaveBeenCalled();
    expect(messagesService.signalTyping).not.toHaveBeenCalled();
    expect(client.connected).toBe(true);
  });

  it("denies message deletion after messages:delete is revoked", async () => {
    permissions.set("u-1", [
      PERMISSIONS.MESSAGES_READ,
      PERMISSIONS.MESSAGES_DELETE,
    ]);
    const url = await startServer();
    const client = await connect(url, "u-1");
    permissions.set("u-1", [PERMISSIONS.MESSAGES_READ]);

    await expect(
      emitWithAck(client, "message:delete", {
        channelId: "ch-1",
        messageId: "m-1",
      }),
    ).resolves.toEqual({ ok: false, error: "Permission denied" });

    expect(messagesService.deleteMessage).not.toHaveBeenCalled();
    expect(client.connected).toBe(true);
  });

  it("removes admin access and suppresses private broadcasts after messages:admin is revoked", async () => {
    channels.set("ch-private", {
      id: "ch-private",
      type: "private",
      members: [{ userId: "u-2" }],
    });
    permissions.set("u-1", [
      PERMISSIONS.MESSAGES_READ,
      PERMISSIONS.MESSAGES_ADMIN,
    ]);
    const url = await startServer();
    const client = await connect(url, "u-1");
    const socketId = client.id;
    if (!socketId) throw new Error("Expected a connected socket id");
    expect(
      ioServer
        ?.of("/messages")
        .adapter.rooms.get(PERMISSIONS.MESSAGES_ADMIN)
        ?.has(socketId),
    ).toBe(true);
    permissions.set("u-1", [PERMISSIONS.MESSAGES_READ]);

    const handler = vi.fn();
    client.on("messages:event", handler);
    messageBus.publish({
      type: "message.created",
      channelId: "ch-private",
      payload: { id: "m-1", channelId: "ch-private", content: "private" },
    });
    await delay(80);

    expect(handler).not.toHaveBeenCalled();
    expect(
      ioServer
        ?.of("/messages")
        .adapter.rooms.get(PERMISSIONS.MESSAGES_ADMIN)
        ?.has(socketId) ?? false,
    ).toBe(false);
    expect(client.connected).toBe(true);
    await expect(joinChannel(client, "ch-private")).resolves.toMatchObject({
      ok: false,
    });
  });
});
