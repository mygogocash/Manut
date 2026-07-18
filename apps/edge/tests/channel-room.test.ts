import { afterEach, describe, expect, it, vi } from "vitest";

import { createEdgeApp } from "../src/index";
import { buildChannelRoomName } from "../src/room-protocol";
import type { RuntimeBindings } from "../src/runtime";

const TEST_TOKEN = "test-token-that-is-long-enough-for-edge-auth";
const BRIDGE_SECRET = "test-only-edge-signing-key-not-a-credential";

function testEnv(
  apiOrigin = "https://api.example",
  overrides: Partial<RuntimeBindings> = {},
): RuntimeBindings {
  return {
    API_ORIGIN: apiOrigin,
    EDGE_SIGNING_KEY: BRIDGE_SECRET,
    API_RATE_LIMITER: {
      limit: vi.fn(async () => ({ success: true })),
    },
    ...overrides,
  } as RuntimeBindings;
}

describe("shared channel realtime rooms", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("builds membership-keyed Durable Object names", () => {
    expect(buildChannelRoomName("ch-abc")).toBe("channel:ch-abc");
    expect(() => buildChannelRoomName("bad id")).toThrow(/Invalid channel/i);
  });

  it("denies WebSocket upgrade when channel membership check fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 403 })),
    );
    const verifyToken = vi.fn(async () => ({
      role: "employee",
      subject: "user-a",
    }));
    const app = createEdgeApp({ verifyToken });
    const response = await app.request(
      "https://intranet.example/api/v1/realtime/rooms/ch-private",
      {
        headers: {
          authorization: `Bearer ${TEST_TOKEN}`,
          upgrade: "websocket",
        },
      },
      testEnv(),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      code: "CHANNEL_ACCESS_DENIED",
    });
  });

  it("fails closed when API origin is missing for membership checks", async () => {
    const verifyToken = vi.fn(async () => ({
      role: "employee",
      subject: "user-a",
    }));
    const app = createEdgeApp({ verifyToken });
    const response = await app.request(
      "https://intranet.example/api/v1/realtime/rooms/ch-1",
      {
        headers: {
          authorization: `Bearer ${TEST_TOKEN}`,
          upgrade: "websocket",
        },
      },
      testEnv(""),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      code: "API_ORIGIN_NOT_CONFIGURED",
    });
  });

  it("rejects bridge fan-out without the shared secret", async () => {
    const app = createEdgeApp({
      verifyToken: async () => ({ role: "employee", subject: "user-a" }),
    });
    const response = await app.request(
      "https://intranet.example/api/v1/realtime/rooms/ch-1/events",
      {
        body: JSON.stringify({
          eventId: "evt-1",
          payload: { type: "message.created", channelId: "ch-1" },
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
      testEnv(),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      code: "REALTIME_BRIDGE_UNAUTHORIZED",
    });
  });

});
