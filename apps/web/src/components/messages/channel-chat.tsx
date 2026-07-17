"use client";

import {
  Hash,
  Loader2,
  Menu,
  MoreVertical,
  Search,
  Trash2,
  User as UserIcon,
  X,
} from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { ChannelMembersPopover } from "@/components/messages/channel-members-popover";
import { ChannelSettingsDialog } from "@/components/messages/channel-settings-dialog";
import { MessageRow } from "@/components/messages/message-bubble";
import { EmptyMessages } from "@/components/messages/message-empty-states";
import { MessageInput } from "@/components/messages/message-input";
import type { TypingState } from "@/components/messages/message-stream";
import {
  formatDateDivider,
  isGroupContinuation,
  isSameDay,
} from "@/components/messages/message-utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import type {
  Channel,
  Message,
  MessageableUser,
} from "@/services/message.service";

function DateDivider({ dateStr }: { dateStr: string }) {
  return (
    <div className="relative mx-5 my-3 flex items-center">
      <div className="bg-border h-px flex-1" />
      <span
        className={`
          bg-background text-muted-foreground mx-3 rounded-full border px-2.5
          py-0.5 text-[11px] leading-none font-medium
        `}
      >
        {formatDateDivider(dateStr)}
      </span>
      <div className="bg-border h-px flex-1" />
    </div>
  );
}

export function ChannelChat({
  channel,
  messages,
  loading,
  currentUserId,
  currentUser,
  peers,
  typing,
  hasOlderMessages,
  loadingOlder,
  onLoadOlder,
  onSent,
  onDelete,
  onHideConversation,
  onChannelUpdated,
  onChannelDeleted,
  canCreate = true,
  canDelete = true,
  canManage = false,
  onToggleMobileSidebar,
}: {
  channel: Channel;
  messages: Message[];
  loading: boolean;
  currentUserId: string;
  currentUser: { id: string; name: string; avatarUrl: string | null };
  peers: MessageableUser[];
  typing: TypingState;
  hasOlderMessages: boolean;
  loadingOlder: boolean;
  onLoadOlder: () => void;
  onSent: (msg: Message) => void;
  onDelete: (id: string) => void;
  onHideConversation?: (channelId: string) => void;
  onChannelUpdated: (channel: Channel) => void;
  onChannelDeleted: (channelId: string) => void;
  canCreate?: boolean;
  canDelete?: boolean;
  canManage?: boolean;
  showMobileSidebar?: boolean;
  onToggleMobileSidebar?: () => void;
}) {
  const isDm = channel.type === "dm";
  const peerName = isDm
    ? (() => {
        const otherIds = (channel.members ?? []).filter(
          (id) => id !== currentUserId,
        );
        if (otherIds.length === 0) return "Direct message";
        return otherIds
          .map((id) => peers.find((p) => p.id === id)?.name ?? "Unknown")
          .join(", ");
      })()
    : null;
  const headerTitle = isDm ? peerName! : channel.name;
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevMsgCount = useRef(0);
  const isNearBottomRef = useRef(true);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [hideDialogOpen, setHideDialogOpen] = useState(false);

  useEffect(() => {
    setSearchOpen(false);
    setSearchQuery("");
    setHideDialogOpen(false);
  }, [channel.id]);

  function updateNearBottom() {
    const el = scrollRef.current;
    if (!el) return;
    isNearBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 96;
  }

  const filteredMessages = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter((m) => m.content.toLowerCase().includes(q));
  }, [messages, searchQuery]);

  useLayoutEffect(() => {
    if (searchQuery) return;
    if (filteredMessages.length !== prevMsgCount.current) {
      const lastMessage = filteredMessages[filteredMessages.length - 1];
      const addedCount = filteredMessages.length - prevMsgCount.current;
      const initialLoad = prevMsgCount.current === 0;
      const shouldScroll =
        initialLoad ||
        isNearBottomRef.current ||
        lastMessage?.authorId === currentUserId;
      if (shouldScroll) {
        bottomRef.current?.scrollIntoView({
          behavior: initialLoad || addedCount > 5 ? "instant" : "smooth",
        });
      }
      prevMsgCount.current = filteredMessages.length;
    }
  }, [currentUserId, filteredMessages, searchQuery]);

  useEffect(() => {
    isNearBottomRef.current = true;
    bottomRef.current?.scrollIntoView({ behavior: "instant" });
    prevMsgCount.current = messages.length;
  }, [channel.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const renderedMessages = useMemo(() => {
    const items: React.ReactNode[] = [];

    for (let i = 0; i < filteredMessages.length; i++) {
      const msg = filteredMessages[i];
      const prev = filteredMessages[i - 1];

      if (i === 0 || !isSameDay(prev.createdAt, msg.createdAt)) {
        items.push(
          <DateDivider key={`date-${msg.createdAt}`} dateStr={msg.createdAt} />,
        );
      }

      const isGroupStart =
        i === 0 ||
        !isSameDay(prev.createdAt, msg.createdAt) ||
        !isGroupContinuation(prev, msg);

      items.push(
        <MessageRow
          key={msg.id}
          message={msg}
          isOwn={msg.authorId === currentUserId}
          isGroupStart={isGroupStart}
          showReadReceipt={isDm}
          onDelete={onDelete}
          canDelete={canDelete}
        />,
      );
    }

    return items;
  }, [filteredMessages, currentUserId, isDm, onDelete, canDelete]);

  const isSearching = searchQuery.trim().length > 0;

  return (
    <div className="flex h-full flex-1 flex-col">
      {/* Chat header */}
      <div
        className={`
          border-border flex h-12 shrink-0 items-center gap-2 border-b px-4
        `}
      >
        {onToggleMobileSidebar && (
          <Button
            variant="ghost"
            size="icon"
            className={`
              text-muted-foreground size-8 shrink-0
              lg:hidden
            `}
            onClick={onToggleMobileSidebar}
          >
            <Menu size={18} />
          </Button>
        )}

        {isDm ? (
          <UserIcon size={16} className="text-muted-foreground shrink-0" />
        ) : (
          <Hash size={16} className="text-muted-foreground shrink-0" />
        )}
        <h2 className="text-foreground truncate text-sm font-bold">
          {headerTitle}
        </h2>

        {!isDm && channel.description && (
          <>
            <div
              className={`
                bg-border mx-0.5 hidden h-4 w-px
                sm:block
              `}
            />
            <p
              className={`
                text-muted-foreground hidden min-w-0 truncate text-xs
                sm:block
              `}
            >
              {channel.description}
            </p>
          </>
        )}

        <div className="ml-auto flex items-center gap-0.5">
          {!isDm && (
            <ChannelMembersPopover
              channel={channel}
              peers={peers}
              currentUserId={currentUserId}
              currentUser={currentUser}
            />
          )}
          {isDm && onHideConversation && (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground size-7"
                    aria-label="Conversation options"
                  >
                    <MoreVertical size={14} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    className={`
                      text-destructive
                      focus:text-destructive
                    `}
                    onSelect={() => setHideDialogOpen(true)}
                  >
                    <Trash2 size={14} className="mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <AlertDialog
                open={hideDialogOpen}
                onOpenChange={setHideDialogOpen}
              >
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This removes the conversation from your inbox only. The
                      other person can still see it until they delete it too.
                      When both of you delete it, the conversation is
                      permanently removed.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className={`
                        bg-destructive text-destructive-foreground
                        hover:bg-destructive/90
                      `}
                      onClick={() => {
                        setHideDialogOpen(false);
                        onHideConversation(channel.id);
                      }}
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground size-7"
            aria-label="Search messages"
            onClick={() => setSearchOpen((v) => !v)}
            data-active={searchOpen}
          >
            <Search size={14} />
          </Button>
          {!isDm && (
            <ChannelSettingsDialog
              channel={channel}
              canManage={canManage}
              onUpdated={onChannelUpdated}
              onDeleted={onChannelDeleted}
            />
          )}
        </div>
      </div>

      {searchOpen && (
        <div
          className={`
            border-border flex shrink-0 items-center gap-2 border-b px-4 py-2
          `}
        >
          <Search size={14} className="text-muted-foreground" />
          <Input
            autoFocus
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search messages in this channel..."
            className="h-8 flex-1 text-sm"
          />
          {isSearching && (
            <span className="text-muted-foreground text-xs">
              {filteredMessages.length}{" "}
              {filteredMessages.length === 1 ? "match" : "matches"}
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => {
              setSearchOpen(false);
              setSearchQuery("");
            }}
            aria-label="Close search"
          >
            <X size={14} />
          </Button>
        </div>
      )}

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto"
        onScroll={updateNearBottom}
      >
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 size={20} className="text-muted-foreground animate-spin" />
          </div>
        ) : filteredMessages.length === 0 ? (
          isSearching ? (
            <div
              className={`
                text-muted-foreground flex h-full items-center justify-center
                text-xs
              `}
            >
              No messages match &quot;{searchQuery}&quot;
            </div>
          ) : (
            <EmptyMessages />
          )
        ) : (
          <div className="flex flex-col pb-2">
            {hasOlderMessages && !isSearching && (
              <div className="flex justify-center py-3">
                <Button
                  variant="ghost"
                  className="text-xs"
                  disabled={loadingOlder}
                  onClick={onLoadOlder}
                >
                  {loadingOlder && (
                    <Loader2 size={12} className="mr-1 animate-spin" />
                  )}
                  Load older messages
                </Button>
              </div>
            )}
            {renderedMessages}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Composer */}
      <MessageInput
        channelId={channel.id}
        currentUser={currentUser}
        typing={typing}
        currentUserId={currentUserId}
        onSent={onSent}
        disabled={!canCreate}
      />
    </div>
  );
}
