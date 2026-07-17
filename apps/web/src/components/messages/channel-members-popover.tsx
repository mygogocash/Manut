"use client";

import { Users } from "lucide-react";
import { useMemo } from "react";

import { getInitials } from "@/components/messages/message-utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Channel, MessageableUser } from "@/services/message.service";

export function ChannelMembersPopover({
  channel,
  peers,
  currentUserId,
  currentUser,
}: {
  channel: Channel;
  peers: MessageableUser[];
  currentUserId: string;
  currentUser: { id: string; name: string; avatarUrl: string | null };
}) {
  const members = useMemo(() => {
    const ids = channel.members ?? [];
    const lookup = new Map<string, MessageableUser>();
    for (const p of peers) lookup.set(p.id, p);
    lookup.set(currentUser.id, {
      id: currentUser.id,
      name: currentUser.name,
      avatarUrl: currentUser.avatarUrl,
    });
    return ids.map((id) => {
      const u = lookup.get(id);
      return {
        id,
        name: u?.name ?? "Unknown",
        avatarUrl: u?.avatarUrl ?? null,
        isSelf: id === currentUserId,
      };
    });
  }, [channel.members, peers, currentUser, currentUserId]);

  const count = members.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground h-7 gap-1 px-2 text-xs"
          aria-label="Channel members"
        >
          <Users size={13} />
          <span>{count}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0">
        <PopoverHeader className="px-3 pt-3">
          <PopoverTitle>Members</PopoverTitle>
          <p className="text-muted-foreground text-xs">
            {count} {count === 1 ? "person" : "people"} in this channel
          </p>
        </PopoverHeader>
        <ScrollArea className="max-h-72">
          <div className="flex flex-col px-1 pt-1 pb-2">
            {members.length === 0 ? (
              <p className="text-muted-foreground px-3 py-4 text-xs">
                No members.
              </p>
            ) : (
              members.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-2.5 rounded-md px-2 py-1.5"
                >
                  <Avatar className="size-7">
                    {m.avatarUrl ? (
                      <AvatarImage src={m.avatarUrl} alt="" />
                    ) : null}
                    <AvatarFallback className="text-[10px]">
                      {getInitials(m.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {m.name}
                    {m.isSelf && (
                      <span className="text-muted-foreground ml-1 text-xs">
                        (you)
                      </span>
                    )}
                  </span>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
