"use client";

import { ChevronRight, Search } from "lucide-react";
import { useMemo } from "react";

import { CreateChannelDialog } from "@/components/messages/create-channel-dialog";
import { getInitials } from "@/components/messages/message-utils";
import { NewDmDialog } from "@/components/messages/new-dm-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { Channel, MessageableUser } from "@/services/message.service";

interface ChannelSidebarProps {
  channels: Channel[];
  peers: MessageableUser[];
  currentUserId: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreated: (channel: Channel) => void;
  onDmCreated: (channel: Channel) => void;
  search: string;
  onSearchChange: (val: string) => void;
  canCreate: boolean;
}

function dmPeerName(
  channel: Channel,
  currentUserId: string,
  peers: MessageableUser[],
): string {
  const otherIds = (channel.members ?? []).filter((id) => id !== currentUserId);
  if (otherIds.length === 0) return "Direct message";
  const names = otherIds.map(
    (id) => peers.find((p) => p.id === id)?.name ?? "Unknown",
  );
  return names.join(", ");
}

export function ChannelSidebar({
  channels,
  peers,
  currentUserId,
  selectedId,
  onSelect,
  onCreated,
  onDmCreated,
  search,
  onSearchChange,
  canCreate,
}: ChannelSidebarProps) {
  const { regularChannels, dmChannels } = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matchesSearch = (text: string) =>
      !q || text.toLowerCase().includes(q);

    const regulars = channels.filter((c) => c.type !== "dm");
    const dms = channels.filter((c) => c.type === "dm");

    return {
      regularChannels: regulars.filter(
        (c) =>
          matchesSearch(c.name) ||
          (c.description ? matchesSearch(c.description) : false),
      ),
      dmChannels: dms.filter((c) =>
        matchesSearch(dmPeerName(c, currentUserId, peers)),
      ),
    };
  }, [channels, peers, currentUserId, search]);

  const hasAny = channels.length > 0;

  return (
    <div className="bg-accent/30 border-border flex h-full flex-col border-r">
      {/* Search */}
      <div className="px-3 pt-4 pb-2">
        <div className="relative">
          <Search
            size={14}
            className={`
              text-muted-foreground/50 absolute top-1/2 left-2.5
              -translate-y-1/2
            `}
          />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search..."
            className={`
              bg-background/60 h-8 rounded-md border-0 pl-8 text-xs shadow-none
              placeholder:text-muted-foreground/50
              focus-visible:ring-1
            `}
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-1 py-1">
          {/* Channels section */}
          <Collapsible defaultOpen>
            <div className="flex items-center px-3 py-1">
              <CollapsibleTrigger
                className={`
                  text-muted-foreground flex flex-1 cursor-pointer items-center
                  gap-1 text-[11px] font-semibold tracking-wider uppercase
                  hover:text-foreground
                  [&[data-state=open]>svg]:rotate-90
                `}
              >
                <ChevronRight
                  size={14}
                  className="shrink-0 transition-transform duration-200"
                />
                Channels
              </CollapsibleTrigger>
              {canCreate && (
                <CreateChannelDialog peers={peers} onCreated={onCreated} />
              )}
            </div>
            <CollapsibleContent>
              {regularChannels.length === 0 ? (
                <p className="text-muted-foreground px-4 py-2 text-xs">
                  No channels yet.
                </p>
              ) : (
                regularChannels.map((channel) => {
                  const isSelected = selectedId === channel.id;
                  const hasUnread =
                    !!channel.unreadCount && channel.unreadCount > 0;
                  return (
                    <button
                      type="button"
                      key={channel.id}
                      onClick={() => onSelect(channel.id)}
                      className={cn(
                        `
                          mx-2 flex w-full flex-1 cursor-pointer items-center
                          gap-1.5 rounded-md px-2 py-[5px] text-[13px]
                          transition-colors
                        `,
                        isSelected
                          ? "bg-primary text-primary-foreground font-medium"
                          : "hover:bg-accent text-foreground/70 hover:text-foreground",
                        hasUnread &&
                          !isSelected &&
                          "text-foreground font-semibold",
                      )}
                    >
                      <span
                        className={cn(
                          "shrink-0 text-[15px]",
                          isSelected
                            ? "text-primary-foreground/70"
                            : "text-muted-foreground",
                        )}
                      >
                        #
                      </span>
                      <span className="min-w-0 flex-1 truncate text-left">
                        {channel.name}
                      </span>
                      {hasUnread && !isSelected && (
                        <span
                          className={`
                            bg-destructive text-destructive-foreground flex
                            h-[18px] min-w-[18px] shrink-0 items-center
                            justify-center rounded-full px-1 text-[10px]
                            leading-none font-bold
                          `}
                        >
                          {channel.unreadCount}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </CollapsibleContent>
          </Collapsible>

          {/* Direct Messages section */}
          <Collapsible defaultOpen>
            <div className="flex items-center px-3 py-1">
              <CollapsibleTrigger
                className={`
                  text-muted-foreground flex flex-1 cursor-pointer items-center
                  gap-1 text-[11px] font-semibold tracking-wider uppercase
                  hover:text-foreground
                  [&[data-state=open]>svg]:rotate-90
                `}
              >
                <ChevronRight
                  size={14}
                  className="shrink-0 transition-transform duration-200"
                />
                Direct Messages
              </CollapsibleTrigger>
              {canCreate && (
                <NewDmDialog peers={peers} onCreated={onDmCreated} />
              )}
            </div>
            <CollapsibleContent>
              {dmChannels.length === 0 ? (
                <p className="text-muted-foreground px-4 py-2 text-xs">
                  No direct messages yet.
                </p>
              ) : (
                dmChannels.map((channel) => {
                  const peerName = dmPeerName(channel, currentUserId, peers);
                  const isSelected = selectedId === channel.id;
                  const hasUnread =
                    !!channel.unreadCount && channel.unreadCount > 0;
                  return (
                    <button
                      type="button"
                      key={channel.id}
                      onClick={() => onSelect(channel.id)}
                      className={cn(
                        `
                          mx-2 flex w-full flex-1 cursor-pointer items-center
                          gap-2 rounded-md px-2 py-[5px] text-[13px]
                          transition-colors
                        `,
                        isSelected
                          ? "bg-primary text-primary-foreground font-medium"
                          : "hover:bg-accent text-foreground/70 hover:text-foreground",
                        hasUnread &&
                          !isSelected &&
                          "text-foreground font-semibold",
                      )}
                    >
                      <div className="relative shrink-0">
                        <div
                          className={cn(
                            `
                              flex size-7 items-center justify-center rounded-md
                              text-[10px] font-semibold
                            `,
                            isSelected
                              ? "bg-primary-foreground/20 text-primary-foreground"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          {getInitials(peerName)}
                        </div>
                        <span
                          className={`
                            border-background absolute -right-0.5 -bottom-0.5
                            size-2.5 rounded-full border-2 bg-emerald-500
                          `}
                        />
                      </div>
                      <span className="min-w-0 flex-1 truncate text-left">
                        {peerName}
                      </span>
                      {hasUnread && !isSelected && (
                        <span
                          className={`
                            bg-destructive text-destructive-foreground flex
                            h-[18px] min-w-[18px] shrink-0 items-center
                            justify-center rounded-full px-1 text-[10px]
                            leading-none font-bold
                          `}
                        >
                          {channel.unreadCount}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </CollapsibleContent>
          </Collapsible>

          {/* No search results */}
          {hasAny &&
            regularChannels.length === 0 &&
            dmChannels.length === 0 &&
            search.trim() && (
              <p
                className={`text-muted-foreground px-4 py-8 text-center text-xs`}
              >
                No matches for &quot;{search}&quot;
              </p>
            )}
        </div>
      </ScrollArea>
    </div>
  );
}

export { dmPeerName };
