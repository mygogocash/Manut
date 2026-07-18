import { afterEach, describe, expect, it, vi } from "vitest";

import { setTestEnv } from "@/test-utils/assertions";

import { messageBus } from "./messages.bus";
import { registerMessagesRealtimeBridge } from "./messages.realtime-bridge";

describe("registerMessagesRealtimeBridge", () => {
  afterEach(() => {
    messageBus.reset();
    setTestEnv("EDGE_REALTIME_ORIGIN", undefined);
    setTestEnv("EDGE_REALTIME_BRIDGE_SECRET", undefined);
    vi.unstubAllGlobals();
  });

  it("stays inactive when origin or secret is unset", () => {
    const fetchImpl = vi.fn();
    const unsubscribe = registerMessagesRealtimeBridge({
      origin: null,
      secret: null,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    messageBus.publish({
      type: "message.created",
      channelId: "ch-1",
      payload: { id: "m1" },
    });
    expect(fetchImpl).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("fans out message.created and message.deleted to the shared DO room", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 202 }));
    const secret = "bridge-secret-at-least-thirty-two-chars!!";
    const unsubscribe = registerMessagesRealtimeBridge({
      origin: "https://edge.example.invalid",
      secret,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    messageBus.publish({
      type: "message.created",
      channelId: "ch-shared",
      payload: { id: "m1", content: "hi" },
    });
    messageBus.publish({
      type: "typing",
      channelId: "ch-shared",
      payload: { userId: "u1", userName: "A", until: Date.now() },
    });
    messageBus.publish({
      type: "message.deleted",
      channelId: "ch-shared",
      payload: { id: "m1", isDeleted: true },
    });

    await vi.waitFor(() => {
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    });

    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      "https://edge.example.invalid/api/v1/realtime/rooms/ch-shared/events",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "x-manut-realtime-bridge": secret,
        }),
      }),
    );
    const firstBody = JSON.parse(
      String((fetchImpl.mock.calls[0]?.[1] as { body?: string }).body),
    ) as { payload: { type: string } };
    expect(firstBody.payload.type).toBe("message.created");

    const secondBody = JSON.parse(
      String((fetchImpl.mock.calls[1]?.[1] as { body?: string }).body),
    ) as { payload: { type: string } };
    expect(secondBody.payload.type).toBe("message.deleted");

    unsubscribe();
  });
});
