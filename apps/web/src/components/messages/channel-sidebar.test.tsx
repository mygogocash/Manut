import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ChannelSidebar } from "@/components/messages/channel-sidebar";
import type { Channel, MessageableUser } from "@/services/message.service";

const CURRENT = "11111111-1111-1111-1111-111111111111";
const PEER = "22222222-2222-2222-2222-222222222222";

const baseChannel: Channel = {
  id: "c1",
  name: "general",
  description: null,
  isPrivate: false,
  members: null,
  type: "channel",
  createdBy: CURRENT,
  createdAt: "2026-05-05T00:00:00Z",
  updatedAt: "2026-05-05T00:00:00Z",
  creator: { id: CURRENT, name: "Me", avatarUrl: null },
  _count: { messages: 0 },
};

const dmChannel: Channel = {
  ...baseChannel,
  id: "dm1",
  name: `dm:${[CURRENT, PEER].sort().join(":")}`,
  isPrivate: true,
  members: [CURRENT, PEER],
  type: "dm",
};

const peers: MessageableUser[] = [{ id: PEER, name: "Bob", avatarUrl: null }];

describe("ChannelSidebar with DMs", () => {
  it("renders separate Channels and Direct Messages sections", () => {
    render(
      <ChannelSidebar
        channels={[baseChannel, dmChannel]}
        peers={peers}
        currentUserId={CURRENT}
        selectedId={null}
        onSelect={vi.fn()}
        onCreated={vi.fn()}
        onDmCreated={vi.fn()}
        search=""
        onSearchChange={vi.fn()}
        canCreate={true}
      />,
    );

    expect(screen.getByText(/Channels/i)).toBeInTheDocument();
    expect(screen.getByText(/Direct Messages/i)).toBeInTheDocument();
  });

  it("renders DM rows with the peer name not the raw channel name", () => {
    render(
      <ChannelSidebar
        channels={[dmChannel]}
        peers={peers}
        currentUserId={CURRENT}
        selectedId={null}
        onSelect={vi.fn()}
        onCreated={vi.fn()}
        onDmCreated={vi.fn()}
        search=""
        onSearchChange={vi.fn()}
        canCreate={true}
      />,
    );

    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.queryByText(dmChannel.name)).not.toBeInTheDocument();
  });

  it("renders unread badge when unreadCount > 0", () => {
    const channelWithUnread: Channel = {
      ...baseChannel,
      id: "c-unread",
      name: "alerts",
      unreadCount: 7,
    };
    render(
      <ChannelSidebar
        channels={[channelWithUnread]}
        peers={peers}
        currentUserId={CURRENT}
        selectedId={null}
        onSelect={vi.fn()}
        onCreated={vi.fn()}
        onDmCreated={vi.fn()}
        search=""
        onSearchChange={vi.fn()}
        canCreate={true}
      />,
    );
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("renders group DM with comma-joined peer names", () => {
    const THIRD = "33333333-3333-3333-3333-333333333333";
    const groupDm: Channel = {
      ...dmChannel,
      id: "dm-grp",
      members: [CURRENT, PEER, THIRD],
      name: `dm:${[CURRENT, PEER, THIRD].sort().join(":")}`,
    };
    const groupPeers = [
      { id: PEER, name: "Bob", avatarUrl: null },
      { id: THIRD, name: "Carol", avatarUrl: null },
    ];

    render(
      <ChannelSidebar
        channels={[groupDm]}
        peers={groupPeers}
        currentUserId={CURRENT}
        selectedId={null}
        onSelect={vi.fn()}
        onCreated={vi.fn()}
        onDmCreated={vi.fn()}
        search=""
        onSearchChange={vi.fn()}
        canCreate={true}
      />,
    );

    expect(screen.getByText(/Bob/)).toBeInTheDocument();
    expect(screen.getByText(/Carol/)).toBeInTheDocument();
  });
});
