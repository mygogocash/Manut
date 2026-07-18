import { evictDurableObject } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createEdgeApp } from "../src/index";
import {
  admitRoomMessage,
  buildChannelRoomName,
  createRoomAttachment,
  MAX_ROOM_MESSAGES_PER_MINUTE,
  parseRoomAttachment,
  parseRoomClientMessage,
} from "../src/room-protocol";
import type { RuntimeBindings } from "../src/runtime";

function roomTestEnv(): RuntimeBindings {
  return {
    ...env,
    API_ORIGIN: "https://api.example",
    EDGE_SIGNING_KEY: "test-only-edge-signing-key-not-a-credential",
  } as RuntimeBindings;
}

function nextMessage(socket: WebSocket): Promise<unknown> {
  return new Promise((resolve, reject) => {
    socket.addEventListener(
      "message",
      (event) => {
        try {
          resolve(JSON.parse(String(event.data)) as unknown);
        } catch (error) {
          reject(error);
        }
      },
      { once: true },
    );
  });
}

describe("realtime room hibernation", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("validates serialized connection state and bounded client messages", () => {
    const principalKey = "p".repeat(43);
    const attachment = createRoomAttachment("connection-1", principalKey, 1234);
    expect(parseRoomAttachment(attachment)).toEqual(attachment);
    expect(
      parseRoomAttachment({ ...attachment, principalKey: "raw-user-id" }),
    ).toBeNull();
    expect(parseRoomClientMessage('{"type":"ping","id":"ping-1"}')).toEqual({
      id: "ping-1",
      type: "ping",
    });
    expect(parseRoomClientMessage("x".repeat(9 * 1024))).toBeNull();
    expect(
      admitRoomMessage(
        { ...attachment, messageCount: MAX_ROOM_MESSAGES_PER_MINUTE },
        1235,
      ),
    ).toBeNull();
    expect(
      admitRoomMessage(
        { ...attachment, messageCount: MAX_ROOM_MESSAGES_PER_MINUTE },
        61_234,
      ),
    ).toMatchObject({ messageCount: 1, windowStartedAt: 61_234 });
  });

  it("restores a hibernating WebSocket attachment after Durable Object eviction", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).includes("/api/messages/channels/")) {
          return new Response(JSON.stringify({ data: { id: "ok" } }), {
            headers: { "content-type": "application/json" },
            status: 200,
          });
        }
        return new Response(null, { status: 404 });
      }),
    );

    const subject = "employee-room-test";
    const roomId = `room-${crypto.randomUUID()}`;
    const stub = env.REALTIME_ROOMS.getByName(buildChannelRoomName(roomId));
    const app = createEdgeApp({
      verifyToken: async () => ({ role: "employee", subject }),
    });
    const response = await app.request(
      `https://intranet.example/api/v1/realtime/rooms/${roomId}`,
      {
        headers: {
          authorization: "Bearer test-token-that-is-long-enough-for-edge-auth",
          upgrade: "websocket",
        },
      },
      roomTestEnv(),
    );
    const socket = response.webSocket;
    expect(response.status).toBe(101);
    expect(socket).not.toBeNull();
    if (!socket) throw new Error("Expected an upgraded WebSocket.");
    socket.accept();

    await expect(nextMessage(socket)).resolves.toMatchObject({
      connectionId: expect.any(String),
      type: "ready",
    });
    await evictDurableObject(stub);

    const pong = nextMessage(socket);
    socket.send(JSON.stringify({ id: "after-hibernation", type: "ping" }));
    await expect(pong).resolves.toEqual({
      id: "after-hibernation",
      type: "pong",
    });
    socket.close(1000, "test complete");
  });

  it("fans out bridge broadcasts to all members of the shared channel room", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).includes("/api/messages/channels/")) {
          return new Response(JSON.stringify({ data: { id: "ok" } }), {
            headers: { "content-type": "application/json" },
            status: 200,
          });
        }
        return new Response(null, { status: 404 });
      }),
    );

    const roomId = `room-${crypto.randomUUID()}`;
    const bindings = roomTestEnv();
    const app = createEdgeApp({
      verifyToken: async () => ({
        role: "employee",
        subject: "bridge-peer",
      }),
    });

    const upgrade = async (subject: string) => {
      const localApp = createEdgeApp({
        verifyToken: async () => ({ role: "employee", subject }),
      });
      const response = await localApp.request(
        `https://intranet.example/api/v1/realtime/rooms/${roomId}`,
        {
          headers: {
            authorization:
              "Bearer test-token-that-is-long-enough-for-edge-auth",
            upgrade: "websocket",
          },
        },
        bindings,
      );
      expect(response.status).toBe(101);
      const socket = response.webSocket;
      if (!socket) throw new Error("Expected WebSocket");
      socket.accept();
      await expect(nextMessage(socket)).resolves.toMatchObject({ type: "ready" });
      return socket;
    };

    const peerA = await upgrade("member-a");
    const peerB = await upgrade("member-b");

    const waitA = nextMessage(peerA);
    const waitB = nextMessage(peerB);

    const bridgeResponse = await app.request(
      `https://intranet.example/api/v1/realtime/rooms/${roomId}/events`,
      {
        body: JSON.stringify({
          eventId: "evt-bridge-1",
          payload: {
            type: "message.created",
            channelId: roomId,
            payload: { id: "msg-1", content: "shared" },
          },
        }),
        headers: {
          "content-type": "application/json",
          "x-manut-realtime-bridge":
            "test-only-edge-signing-key-not-a-credential",
        },
        method: "POST",
      },
      bindings,
    );
    expect(bridgeResponse.status).toBe(202);

    await expect(waitA).resolves.toMatchObject({
      type: "broadcast",
      eventId: "evt-bridge-1",
      sender: "system",
      payload: expect.objectContaining({ type: "message.created" }),
    });
    await expect(waitB).resolves.toMatchObject({
      type: "broadcast",
      eventId: "evt-bridge-1",
    });

    peerA.close(1000, "done");
    peerB.close(1000, "done");
  });
});
