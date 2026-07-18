import { joinMessagesChannel } from "@/platform/messages-socket";

describe("joinMessagesChannel", () => {
  it("connects, joins the channel, and forwards parsed live events", async () => {
    const handlers = new Map<string, Set<(...args: unknown[]) => void>>();
    const emit = jest.fn();
    const connect = jest.fn(() => {
      for (const handler of handlers.get("connect") ?? []) {
        handler();
      }
    });
    const disconnect = jest.fn();
    const on = jest.fn((event: string, handler: (...args: unknown[]) => void) => {
      let set = handlers.get(event);
      if (!set) {
        set = new Set();
        handlers.set(event, set);
      }
      set.add(handler);
    });
    const off = jest.fn();
    const onEvent = jest.fn();
    const onStatus = jest.fn();

    const client = joinMessagesChannel({
      channelId: "ch-1",
      onEvent,
      onStatus,
      resolveUrl: () => "https://api.example.invalid/messages",
      resolveAuth: async () => ({ withCredentials: true }),
      createSocket: () => ({
        connected: false,
        connect,
        disconnect,
        emit,
        on,
        off,
      }),
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(connect).toHaveBeenCalled();
    expect(onStatus).toHaveBeenCalledWith("connected");
    expect(emit).toHaveBeenCalledWith("channel:join", { channelId: "ch-1" });

    const eventHandlers = handlers.get("messages:event");
    expect(eventHandlers?.size).toBe(1);
    for (const handler of eventHandlers ?? []) {
      handler({
        type: "message.created",
        channelId: "ch-1",
        payload: {
          id: "msg-9",
          channelId: "ch-1",
          content: "Peer hello",
          isDeleted: false,
          createdAt: "2026-07-02T12:00:00.000Z",
          author: { id: "u-2", name: "Grace" },
        },
      });
      handler({
        type: "message.created",
        channelId: "other",
        payload: {
          id: "msg-x",
          channelId: "other",
          content: "Wrong channel",
          isDeleted: false,
          createdAt: "2026-07-02T12:00:00.000Z",
          author: { id: "u-3", name: "Other" },
        },
      });
    }

    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "message.created",
        channelId: "ch-1",
        payload: expect.objectContaining({ content: "Peer hello" }),
      }),
    );

    client.close();
    expect(emit).toHaveBeenCalledWith("channel:leave", { channelId: "ch-1" });
    expect(disconnect).toHaveBeenCalled();
  });

  it("surfaces an error when the socket URL is missing", async () => {
    const onError = jest.fn();
    const onStatus = jest.fn();
    joinMessagesChannel({
      channelId: "ch-1",
      onEvent: jest.fn(),
      onStatus,
      onError,
      resolveUrl: () => null,
      resolveAuth: async () => ({ withCredentials: true }),
      createSocket: () => {
        throw new Error("should not create");
      },
    });
    await Promise.resolve();
    expect(onStatus).toHaveBeenCalledWith("error");
    expect(onError).toHaveBeenCalledWith(expect.stringMatching(/SOCKET_URL|API_URL/i));
  });
});
