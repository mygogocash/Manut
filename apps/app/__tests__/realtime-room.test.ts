import { joinRealtimeRoom } from "@/platform/realtime-room";

describe("joinRealtimeRoom", () => {
  it("opens a websocket, surfaces ready, and supports ping", () => {
    const listeners = new Map<string, Set<(event?: { data?: string }) => void>>();
    const sent: string[] = [];
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
      send: (payload: string) => {
        sent.push(payload);
      },
      close: jest.fn(),
    };

    const statuses: string[] = [];
    const client = joinRealtimeRoom({
      origin: "https://intranet.example",
      roomId: "channel-1",
      createSocket: () => socket as unknown as WebSocket,
      onStatus: (status) => {
        statuses.push(status);
      },
    });

    expect(statuses[0]).toBeUndefined();
    listeners.get("message")?.forEach((handler) => {
      handler({
        data: JSON.stringify({ type: "ready", connectionId: "c-1" }),
      });
    });
    expect(client.status).toBe("ready");
    client.ping("probe-1");
    expect(sent).toEqual([JSON.stringify({ type: "ping", id: "probe-1" })]);
    client.close();
    expect(socket.close).toHaveBeenCalled();
  });
});
