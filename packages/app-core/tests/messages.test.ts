import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../src/api/api-client";
import {
  listMessageChannels,
  messageChannelSchema,
  messageChannelsQueryKey,
} from "../src/messages/messages";

const channel = {
  id: "ch-1",
  name: "General",
  description: "Company updates",
  isPrivate: false,
  type: "channel",
  members: null,
  createdBy: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-02T00:00:00.000Z",
  creator: { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", name: "Ada" },
  _count: { messages: 12 },
  unreadCount: 3,
};

describe("messages foundation contracts", () => {
  it("projects channel list fields for a read-only inbox", () => {
    const parsed = messageChannelSchema.parse(channel);
    expect(parsed).toEqual({
      id: "ch-1",
      name: "General",
      description: "Company updates",
      isPrivate: false,
      type: "channel",
      unreadCount: 3,
      messageCount: 12,
      updatedAt: "2026-07-02T00:00:00.000Z",
    });
    expect(parsed).not.toHaveProperty("members");
    expect(parsed).not.toHaveProperty("createdBy");
  });

  it("lists channels via REST", async () => {
    const signal = { aborted: false };
    const get = vi.fn().mockResolvedValue({ data: [channel] });
    const client = { get } as unknown as ApiClient;

    await expect(listMessageChannels(client, signal)).resolves.toEqual({
      data: [
        expect.objectContaining({
          id: "ch-1",
          name: "General",
          unreadCount: 3,
          messageCount: 12,
        }),
      ],
    });
    expect(get).toHaveBeenCalledWith("/messages/channels", { signal });
    expect(messageChannelsQueryKey()).toEqual(["messages", "channels"]);
  });
});
