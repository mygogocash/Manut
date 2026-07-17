import { describe, expect, it } from "vitest";

import { PERMISSIONS } from "@/common/constants/permissions";
import {
  canAccessChannel,
  channelMemberIds,
} from "@/modules/messages/messages.access";

const readUser = {
  id: "u-1",
  permissions: [PERMISSIONS.MESSAGES_READ],
};

const adminUser = {
  id: "admin",
  permissions: [PERMISSIONS.MESSAGES_READ, PERMISSIONS.MESSAGES_ADMIN],
};

describe("messages channel access", () => {
  it("group channels are visible to users with messages:read", () => {
    expect(
      canAccessChannel(readUser, {
        id: "ch-public",
        type: "group",
        members: [],
      }),
    ).toBe(true);
  });

  it("private channels are visible only to members or messages admins", () => {
    const channel = {
      id: "ch-private",
      type: "private",
      members: [{ userId: "u-2" }],
    };

    expect(canAccessChannel(readUser, channel)).toBe(false);
    expect(canAccessChannel({ ...readUser, id: "u-2" }, channel)).toBe(true);
    expect(canAccessChannel(adminUser, channel)).toBe(true);
  });

  it("DMs are visible only to members, not admins by permission alone", () => {
    const channel = {
      id: "ch-dm",
      type: "direct",
      members: [{ userId: "u-2" }, { userId: "u-3" }],
    };

    expect(canAccessChannel(readUser, channel)).toBe(false);
    expect(canAccessChannel({ ...readUser, id: "u-2" }, channel)).toBe(true);
    expect(canAccessChannel(adminUser, channel)).toBe(false);
  });

  it("extracts userIds from members array", () => {
    expect(
      channelMemberIds({
        members: [{ userId: "u-1" }, { userId: "u-2" }],
      }),
    ).toEqual(["u-1", "u-2"]);
  });
});
