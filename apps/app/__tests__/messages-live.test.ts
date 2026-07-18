import { joinMessagesLiveChannel } from "@/platform/messages-live";

describe("joinMessagesLiveChannel", () => {
  it("uses socket.io when no realtime origin is configured", async () => {
    const onTransport = jest.fn();
    const createSocket = jest.fn(() => ({
      connected: false,
      connect: jest.fn(),
      disconnect: jest.fn(),
      emit: jest.fn(),
      on: jest.fn((event: string, handler: () => void) => {
        if (event === "connect") handler();
      }),
      off: jest.fn(),
    }));

    const client = joinMessagesLiveChannel({
      channelId: "ch-1",
      onEvent: jest.fn(),
      onTransport,
      resolveRealtimeOrigin: () => null,
      resolveUrl: () => "https://api.example.invalid/messages",
      resolveAuth: async () => ({ withCredentials: true }),
      createSocket,
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(onTransport).toHaveBeenCalledWith("socket.io");
    expect(createSocket).toHaveBeenCalled();
    client.close();
  });

  it("prefers the Durable Object path and forwards broadcast live events", async () => {
    const onTransport = jest.fn();
    const onEvent = jest.fn();
    const onStatus = jest.fn();
    const listeners = new Map<
      string,
      Set<(event?: { data?: string }) => void>
    >();
    const socket = {
      readyState: 1,
      addEventListener: (
        type: string,
        handler: (event?: { data?: string }) => void,
      ) => {
        const set = listeners.get(type) ?? new Set();
        set.add(handler);
        listeners.set(type, set);
      },
      send: jest.fn(),
      close: jest.fn(),
    };

    const client = joinMessagesLiveChannel({
      channelId: "ch-1",
      onEvent,
      onStatus,
      onTransport,
      resolveRealtimeOrigin: () => "https://intranet.example",
      resolveAuth: async () => ({ withCredentials: true }),
      createRealtimeSocket: () => socket as unknown as WebSocket,
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(onTransport).toHaveBeenCalledWith("durable-object");

    for (const handler of listeners.get("message") ?? []) {
      handler({
        data: JSON.stringify({ type: "ready", connectionId: "c-1" }),
      });
      handler({
        data: JSON.stringify({
          type: "broadcast",
          eventId: "evt-1",
          sender: "system",
          payload: {
            type: "message.created",
            channelId: "ch-1",
            payload: {
              id: "msg-9",
              channelId: "ch-1",
              content: "From DO",
              isDeleted: false,
              createdAt: "2026-07-02T12:00:00.000Z",
              author: { id: "u-2", name: "Grace" },
            },
          },
        }),
      });
    }

    expect(onStatus).toHaveBeenCalledWith("connected");
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "message.created",
        channelId: "ch-1",
        payload: expect.objectContaining({ content: "From DO" }),
      }),
    );
    client.close();
  });
});
