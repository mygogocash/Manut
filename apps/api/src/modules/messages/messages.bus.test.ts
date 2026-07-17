import { beforeEach, describe, expect, it, vi } from "vitest";

import { formatSseEvent, messageBus } from "@/modules/messages/messages.bus";

describe("messageBus", () => {
  beforeEach(() => {
    messageBus.reset();
  });

  it("delivers an event to a matching channel subscriber", () => {
    const handler = vi.fn();
    messageBus.subscribe("ch-1", handler);

    const event = {
      type: "message.created" as const,
      channelId: "ch-1",
      payload: { id: "m1", content: "hi" },
    };
    messageBus.publish(event);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(event);
  });

  it("unsubscribe stops delivery", () => {
    const handler = vi.fn();
    const unsubscribe = messageBus.subscribe("ch-1", handler);
    unsubscribe();
    messageBus.publish({
      type: "message.created",
      channelId: "ch-1",
      payload: { id: "m1" },
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it("formatSseEvent emits 'data: {json}\\n\\n' frame", () => {
    const frame = formatSseEvent({
      type: "message.created",
      channelId: "ch-1",
      payload: { id: "m1" },
    });
    expect(frame.endsWith("\n\n")).toBe(true);
    expect(frame.startsWith("data: ")).toBe(true);
    const json = frame.slice("data: ".length, -2);
    expect(JSON.parse(json)).toEqual({
      type: "message.created",
      channelId: "ch-1",
      payload: { id: "m1" },
    });
  });

  it("scopes events by channelId; other channels do not receive them", () => {
    const a = vi.fn();
    const b = vi.fn();
    messageBus.subscribe("ch-A", a);
    messageBus.subscribe("ch-B", b);

    messageBus.publish({
      type: "message.created",
      channelId: "ch-A",
      payload: { id: "m1" },
    });

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).not.toHaveBeenCalled();
  });

  it("subscribeAll receives events from every channel", () => {
    const handler = vi.fn();
    messageBus.subscribeAll(handler);

    messageBus.publish({
      type: "channel.created",
      channelId: "ch-A",
      payload: { id: "ch-A" },
    });
    messageBus.publish({
      type: "message.deleted",
      channelId: "ch-B",
      payload: { messageId: "m1" },
    });

    expect(handler).toHaveBeenCalledTimes(2);
  });
});
