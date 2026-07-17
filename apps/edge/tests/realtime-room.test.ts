import { evictDurableObject } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import { sha256Base64Url } from "../src/crypto";
import { createEdgeApp } from "../src/index";
import {
  admitRoomMessage,
  createRoomAttachment,
  MAX_ROOM_MESSAGES_PER_MINUTE,
  parseRoomAttachment,
  parseRoomClientMessage,
} from "../src/room-protocol";

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
    const subject = "employee-room-test";
    const principalKey = await sha256Base64Url(subject);
    const roomId = `room-${crypto.randomUUID()}`;
    const stub = env.REALTIME_ROOMS.getByName(`${principalKey}:${roomId}`);
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
      env,
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
});
