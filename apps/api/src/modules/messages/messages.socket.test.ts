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
import { registerMessagesSocket } from "@/modules/messages/messages.socket";

vi.mock("@/modules/messages/messages.repository", () => ({
  messagesRepository: {
    findChannelById: vi.fn(),
  },
}));

const channels = new Map<string, unknown>();
const permissions = new Map<string, string[]>();
let httpServer: HttpServer | null = null;
let clients: ClientSocket[] = [];
let ioServer: ReturnType<typeof registerMessagesSocket> | null = null;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function startServer() {
  httpServer = createServer();
  ioServer = registerMessagesSocket(httpServer, {
    async resolveUserFromToken(token) {
      if (!token) throw new Error("Unauthorized");
      return {
        id: token,
        email: `${token}@example.com`,
        name: token,
        isActive: true,
        entityId: null,
        permissions: [],
      };
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

describe("messages socket", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    messageBus.reset();
    clients = [];
    channels.clear();
    permissions.clear();
    (messagesRepository.findChannelById as Mock).mockImplementation(
      async (channelId: string) => channels.get(channelId) ?? null,
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
});
