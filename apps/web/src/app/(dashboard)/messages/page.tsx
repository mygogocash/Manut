"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { ChannelChat } from "@/components/messages/channel-chat";
import { ChannelSidebar } from "@/components/messages/channel-sidebar";
import { NoChannelSelected } from "@/components/messages/message-empty-states";
import {
  applyChannelListEvent,
  applyMessageEvent,
  applyTypingEvent,
  getMessagesRealtimeSocket,
  pruneTyping,
  type TypingState,
  useMessagesSocket,
} from "@/components/messages/message-stream";
import { MESSAGES_PER_PAGE } from "@/components/messages/message-utils";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import type {
  Channel,
  Message,
  MessageableUser,
} from "@/services/message.service";
import * as messageService from "@/services/message.service";

export default function MessagesPage() {
  const { user, hasPermission } = useAuth();

  const canCreate = hasPermission("messages:create");
  const canDelete = hasPermission("messages:delete");
  const canManage = hasPermission("messages:admin");

  const [channels, setChannels] = useState<Channel[]>([]);
  const [peers, setPeers] = useState<MessageableUser[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(
    null,
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [channelsLoading, setChannelsLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [channelSearch, setChannelSearch] = useState("");
  const [showMobileSidebar, setShowMobileSidebar] = useState(true);
  const [typing, setTyping] = useState<TypingState>({});

  const selectedChannel = useMemo(
    () => channels.find((c) => c.id === selectedChannelId) ?? null,
    [channels, selectedChannelId],
  );

  const fetchChannels = useCallback(async () => {
    try {
      const res = await messageService.getChannels();
      setChannels(res.data);
    } catch {
      toast.error("Failed to load channels");
    } finally {
      setChannelsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  useEffect(() => {
    messageService
      .getMessageableUsers()
      .then((res) => setPeers(res.data))
      .catch(() => {
        /* picker stays empty; surfaced when user opens dialog */
      });
  }, []);

  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const currentPageRef = useRef(1);
  const knownMessageIdsRef = useRef(new Set<string>());
  const deletedMessageIdsRef = useRef(new Set<string>());

  const fetchMessages = useCallback(
    async (channelId: string, page = 1, prepend = false) => {
      try {
        const res = await messageService.getMessages(channelId, {
          page,
          limit: MESSAGES_PER_PAGE,
        });
        if (prepend) {
          setMessages((prev) => [...res.data, ...prev]);
        } else {
          setMessages(res.data);
        }
        for (const message of res.data) {
          knownMessageIdsRef.current.add(message.id);
        }
        const { total, page: currentPage, limit } = res.meta;
        setHasOlderMessages(currentPage * limit < total);
        currentPageRef.current = currentPage;
      } catch {
        toast.error("Failed to load messages");
      }
    },
    [],
  );

  useEffect(() => {
    if (!selectedChannelId) {
      setMessages([]);
      setHasOlderMessages(false);
      currentPageRef.current = 1;
      return;
    }

    setMessagesLoading(true);
    fetchMessages(selectedChannelId).finally(() => setMessagesLoading(false));
  }, [selectedChannelId, fetchMessages]);

  const handleStreamEvent = useCallback(
    (event: Parameters<typeof applyMessageEvent>[1]) => {
      if (event.type === "typing") {
        if (event.channelId !== selectedChannelId) return;
        setTyping((prev) => applyTypingEvent(prev, event));
        return;
      }

      if (event.type === "channel.deleted") {
        setChannels((prev) =>
          applyChannelListEvent(prev, event, {
            currentUserId: user?.id ?? null,
            selectedChannelId,
          }),
        );
        if (event.channelId === selectedChannelId) {
          setSelectedChannelId(null);
          setMessages([]);
          setTyping({});
          setShowMobileSidebar(true);
        }
        return;
      }

      if (event.type === "message.created") {
        const alreadyKnown = knownMessageIdsRef.current.has(event.payload.id);
        knownMessageIdsRef.current.add(event.payload.id);

        if (event.channelId === selectedChannelId) {
          setTyping((prev) => {
            if (!(event.payload.authorId in prev)) return prev;
            const next = { ...prev };
            delete next[event.payload.authorId];
            return next;
          });
        }

        setChannels((prev) =>
          applyChannelListEvent(prev, event, {
            currentUserId: user?.id ?? null,
            selectedChannelId,
            messageAlreadyKnown: alreadyKnown,
          }),
        );

        if (event.channelId === selectedChannelId) {
          const isOwnMessage = event.payload.authorId === user?.id;
          if (isOwnMessage) {
            setMessages((prev) => {
              const optimisticIdx = prev.findIndex(
                (m) =>
                  m.id.startsWith("optimistic-") &&
                  m.authorId === event.payload.authorId &&
                  m.content === event.payload.content,
              );
              if (optimisticIdx !== -1) {
                const next = [...prev];
                next[optimisticIdx] = event.payload;
                return next;
              }
              return applyMessageEvent(prev, event);
            });
          } else {
            setMessages((prev) => applyMessageEvent(prev, event));
            messageService.markChannelRead(event.channelId).catch(() => {
              /* best-effort active-channel read tracking */
            });
          }
        }
        return;
      }

      if (event.type === "message.deleted") {
        if (!deletedMessageIdsRef.current.has(event.payload.id)) {
          deletedMessageIdsRef.current.add(event.payload.id);
        }
        if (event.channelId === selectedChannelId) {
          setMessages((prev) => applyMessageEvent(prev, event));
        }
        return;
      }

      setChannels((prev) =>
        applyChannelListEvent(prev, event, {
          currentUserId: user?.id ?? null,
          selectedChannelId,
        }),
      );

      if (event.channelId === selectedChannelId) {
        setMessages((prev) => applyMessageEvent(prev, event));
      }
    },
    [selectedChannelId, user?.id],
  );

  const handleSocketReconnect = useCallback(() => {
    fetchChannels();
    if (selectedChannelId) {
      fetchMessages(selectedChannelId);
      messageService.markChannelRead(selectedChannelId).catch(() => {
        /* best-effort read tracking */
      });
    }
  }, [fetchChannels, fetchMessages, selectedChannelId]);

  useMessagesSocket({
    selectedChannelId,
    onEvent: handleStreamEvent,
    onReconnect: handleSocketReconnect,
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setTyping((prev) => pruneTyping(prev, Date.now()));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setTyping({});
  }, [selectedChannelId]);

  const handleLoadOlder = useCallback(async () => {
    if (!selectedChannelId || loadingOlder) return;
    setLoadingOlder(true);
    await fetchMessages(selectedChannelId, currentPageRef.current + 1, true);
    setLoadingOlder(false);
  }, [selectedChannelId, loadingOlder, fetchMessages]);

  const handleSelectChannel = (id: string) => {
    setSelectedChannelId(id);
    setShowMobileSidebar(false);
    messageService.markChannelRead(id).catch(() => {
      /* swallow: best-effort read tracking */
    });
    setChannels((prev) =>
      prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c)),
    );
  };

  const handleChannelCreated = (channel: Channel) => {
    setChannels((prev) =>
      prev.some((c) => c.id === channel.id) ? prev : [channel, ...prev],
    );
    setSelectedChannelId(channel.id);
    setShowMobileSidebar(false);
  };

  const handleDmCreated = (channel: Channel) => {
    setChannels((prev) =>
      prev.some((c) => c.id === channel.id) ? prev : [channel, ...prev],
    );
    setSelectedChannelId(channel.id);
    setShowMobileSidebar(false);
  };

  const handleMessageSent = (msg: Message) => {
    setMessages((prev) =>
      prev.some((m) => m.id === msg.id) ? prev : [...prev, msg],
    );
    if (msg.id.startsWith("optimistic-")) return;
    const alreadyKnown = knownMessageIdsRef.current.has(msg.id);
    knownMessageIdsRef.current.add(msg.id);
    if (alreadyKnown) return;
    setChannels((prev) =>
      prev.map((c) =>
        c.id === msg.channelId
          ? {
              ...c,
              _count: { messages: c._count.messages + 1 },
              updatedAt: msg.createdAt,
            }
          : c,
      ),
    );
  };

  const handleChannelUpdated = (updated: Channel) => {
    setChannels((prev) =>
      prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)),
    );
  };

  const handleChannelDeleted = (channelId: string) => {
    setChannels((prev) => prev.filter((c) => c.id !== channelId));
    if (selectedChannelId === channelId) {
      setSelectedChannelId(null);
      setMessages([]);
      setTyping({});
      setShowMobileSidebar(true);
    }
  };

  const handleDeleteMessage = (messageId: string) => {
    if (!selectedChannelId) return;

    const markDeleted = (prev: Message[]) =>
      prev.map((m) =>
        m.id === messageId
          ? { ...m, isDeleted: true, content: "", attachments: [] }
          : m,
      );

    deletedMessageIdsRef.current.add(messageId);
    setMessages(markDeleted);

    const socket = getMessagesRealtimeSocket();
    if (socket.connected) {
      socket.emit("message:delete", {
        channelId: selectedChannelId,
        messageId,
      });
    } else {
      messageService
        .deleteMessage(selectedChannelId, messageId)
        .then((res) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === messageId ? res.data : m)),
          );
        })
        .catch(() => {
          deletedMessageIdsRef.current.delete(messageId);
          fetchMessages(selectedChannelId).catch(() => {
            toast.error("Failed to delete message");
          });
        });
    }
  };

  const handleHideConversation = (channelId: string) => {
    messageService
      .hideConversation(channelId)
      .then((res) => {
        setChannels((prev) => prev.filter((c) => c.id !== channelId));
        if (selectedChannelId === channelId) {
          setSelectedChannelId(null);
          setMessages([]);
          setTyping({});
          setShowMobileSidebar(true);
        }
        if (res.data.hardDeleted) {
          toast.success("Conversation deleted");
        } else {
          toast.success("Conversation removed from your inbox");
        }
      })
      .catch(() => {
        toast.error("Failed to delete conversation");
      });
  };

  if (channelsLoading) {
    return (
      <div className="-mx-6 -my-5 flex flex-1 items-center justify-center">
        <Loader2 size={24} className="text-muted-foreground animate-spin" />
      </div>
    );
  }

  return (
    <div className="-mx-6 -my-5 flex min-h-0 flex-1 overflow-hidden">
      {/* The only dashboard route with no page heading of its own: this is a
          full-height chat shell, and a visible title would take space the
          conversation needs. `sr-only` gives it the page-level heading every
          other route gets from PageHeader, using the sidebar's own label
          rather than new copy. */}
      <h1 className="sr-only">Messaging</h1>
      <div
        className={cn(
          "h-full w-72 shrink-0",
          showMobileSidebar ? "block" : "hidden lg:block",
        )}
      >
        <ChannelSidebar
          channels={channels}
          peers={peers}
          currentUserId={user?.id ?? ""}
          selectedId={selectedChannelId}
          onSelect={handleSelectChannel}
          onCreated={handleChannelCreated}
          onDmCreated={handleDmCreated}
          search={channelSearch}
          onSearchChange={setChannelSearch}
          canCreate={canCreate}
        />
      </div>

      <div
        className={cn(
          "min-w-0 flex-1",
          showMobileSidebar && "hidden lg:flex",
          !showMobileSidebar && "flex",
        )}
      >
        {selectedChannel && user ? (
          <ChannelChat
            channel={selectedChannel}
            messages={messages}
            loading={messagesLoading}
            currentUserId={user.id}
            currentUser={{
              id: user.id,
              name: user.name,
              avatarUrl: user.avatarUrl,
            }}
            peers={peers}
            typing={typing}
            hasOlderMessages={hasOlderMessages}
            loadingOlder={loadingOlder}
            onLoadOlder={handleLoadOlder}
            onSent={handleMessageSent}
            onDelete={handleDeleteMessage}
            onHideConversation={handleHideConversation}
            onChannelUpdated={handleChannelUpdated}
            onChannelDeleted={handleChannelDeleted}
            canCreate={canCreate}
            canDelete={canDelete}
            canManage={canManage}
            showMobileSidebar={showMobileSidebar}
            onToggleMobileSidebar={() =>
              setShowMobileSidebar(!showMobileSidebar)
            }
          />
        ) : (
          <NoChannelSelected />
        )}
      </div>
    </div>
  );
}
