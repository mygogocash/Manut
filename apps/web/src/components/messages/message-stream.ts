"use client";

import { useEffect, useRef } from "react";
import { io } from "socket.io-client";

import type { Channel, Message } from "@/services/message.service";

export type ChannelEvent =
  | {
      type: "message.created";
      channelId: string;
      payload: Message;
    }
  | {
      type: "message.deleted";
      channelId: string;
      payload: Message;
    }
  | {
      type: "typing";
      channelId: string;
      payload: { userId: string; userName: string; until: number };
    }
  | {
      type: "channel.read";
      channelId: string;
      payload: { userId: string; lastReadAt: string };
    }
  | {
      type: "channel.created";
      channelId: string;
      payload: Channel;
    }
  | {
      type: "channel.updated";
      channelId: string;
      payload: Channel;
    }
  | {
      type: "channel.deleted";
      channelId: string;
      payload: Channel;
    };

export type TypingState = Record<string, { userName: string; until: number }>;

type SocketHandler = (...args: unknown[]) => void;

export interface MessagesRealtimeSocket {
  connected: boolean;
  connect: () => void;
  disconnect: () => void;
  emit: (event: string, ...args: unknown[]) => void;
  on: (event: string, handler: SocketHandler) => void;
  off: (event: string, handler: SocketHandler) => void;
}

export type MessagesSocketFactory = () => MessagesRealtimeSocket;

let messagesSocket: MessagesRealtimeSocket | null = null;

function socketUrl() {
  const configured = process.env.NEXT_PUBLIC_SOCKET_URL?.trim();
  if (configured && configured !== "/") {
    return `${configured.replace(/\/+$/, "")}/messages`;
  }
  return "/messages";
}

export function getMessagesRealtimeSocket(): MessagesRealtimeSocket {
  if (!messagesSocket) {
    messagesSocket = io(socketUrl(), {
      path: "/socket.io/",
      // Force WebSocket only — skip the polling-then-upgrade dance.
      // Cloud Run multi-instance routes the long-poll handshake and
      // the upgrade request to different instances, which surfaced in
      // the console as `WebSocket is closed before the connection is
      // established` + a 400 on `EIO=4&transport=...`. Pure WebSocket
      // connects to a single instance without the upgrade step.
      transports: ["websocket"],
      withCredentials: true,
      autoConnect: false,
    }) as unknown as MessagesRealtimeSocket;
  }
  return messagesSocket;
}

export function socketSignalTyping(channelId: string): void {
  const socket = getMessagesRealtimeSocket();
  if (!socket.connected) return;
  socket.emit("typing", { channelId });
}

function compareMessages(a: Message, b: Message) {
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
}

function compareChannels(a: Channel, b: Channel) {
  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
}

function sortChannels(channels: Channel[]) {
  return [...channels].sort(compareChannels);
}

function upsertChannel(channels: Channel[], channel: Channel) {
  const exists = channels.some((c) => c.id === channel.id);
  return sortChannels(
    exists
      ? channels.map((c) => (c.id === channel.id ? { ...c, ...channel } : c))
      : [channel, ...channels],
  );
}

export function applyMessageEvent(
  current: Message[],
  event: ChannelEvent,
): Message[] {
  switch (event.type) {
    case "message.created": {
      if (current.some((m) => m.id === event.payload.id)) return current;
      return [...current, event.payload].sort(compareMessages);
    }
    case "message.deleted": {
      const idx = current.findIndex((m) => m.id === event.payload.id);
      if (idx === -1) return [...current, event.payload].sort(compareMessages);
      const next = [...current];
      next[idx] = event.payload;
      return next;
    }
    case "channel.read": {
      const lastReadAt = event.payload.lastReadAt;
      const userId = event.payload.userId;
      let changed = false;
      const next = current.map((m) => {
        if (m.authorId === userId) return m;
        if (m.createdAt > lastReadAt) return m;
        const readBy = m.readBy ?? [];
        if (readBy.includes(userId)) return m;
        changed = true;
        return { ...m, readBy: [...readBy, userId] };
      });
      return changed ? next : current;
    }
    default:
      return current;
  }
}

export function applyChannelListEvent(
  current: Channel[],
  event: ChannelEvent,
  context: {
    currentUserId: string | null;
    selectedChannelId: string | null;
    messageAlreadyKnown?: boolean;
    deletionAlreadyKnown?: boolean;
  },
): Channel[] {
  switch (event.type) {
    case "channel.created":
    case "channel.updated":
      return upsertChannel(current, event.payload);
    case "channel.deleted":
      return current.filter((c) => c.id !== event.payload.id);
    case "message.created": {
      const increment = context.messageAlreadyKnown ? 0 : 1;
      return sortChannels(
        current.map((channel) => {
          if (channel.id !== event.channelId) return channel;
          const unreadIncrement =
            !context.messageAlreadyKnown &&
            context.selectedChannelId !== event.channelId &&
            event.payload.authorId !== context.currentUserId
              ? 1
              : 0;
          return {
            ...channel,
            _count: {
              messages: channel._count.messages + increment,
            },
            unreadCount: (channel.unreadCount ?? 0) + unreadIncrement,
            updatedAt: event.payload.createdAt,
          };
        }),
      );
    }
    case "message.deleted":
      return current;
    case "channel.read":
      if (event.payload.userId !== context.currentUserId) return current;
      return current.map((channel) =>
        channel.id === event.channelId
          ? { ...channel, unreadCount: 0 }
          : channel,
      );
    default:
      return current;
  }
}

export function applyTypingEvent(
  current: TypingState,
  event: Extract<ChannelEvent, { type: "typing" }>,
): TypingState {
  return {
    ...current,
    [event.payload.userId]: {
      userName: event.payload.userName,
      until: event.payload.until,
    },
  };
}

export function pruneTyping(state: TypingState, now: number): TypingState {
  const next: TypingState = {};
  for (const [userId, entry] of Object.entries(state)) {
    if (entry.until > now) next[userId] = entry;
  }
  return next;
}

export function useMessagesSocket({
  selectedChannelId,
  onEvent,
  onReconnect,
  factory = getMessagesRealtimeSocket,
}: {
  selectedChannelId: string | null;
  onEvent: (event: ChannelEvent) => void;
  onReconnect: () => void;
  factory?: MessagesSocketFactory;
}) {
  const onEventRef = useRef(onEvent);
  const onReconnectRef = useRef(onReconnect);
  const selectedChannelRef = useRef(selectedChannelId);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    onReconnectRef.current = onReconnect;
  }, [onReconnect]);

  useEffect(() => {
    selectedChannelRef.current = selectedChannelId;
  }, [selectedChannelId]);

  useEffect(() => {
    const socket = factory();

    const handleEvent: SocketHandler = (event) => {
      onEventRef.current(event as ChannelEvent);
    };

    const handleConnect = () => {
      const channelId = selectedChannelRef.current;
      if (channelId) {
        socket.emit("channel:join", { channelId });
      }
      onReconnectRef.current();
    };

    socket.on("messages:event", handleEvent);
    socket.on("connect", handleConnect);

    if (socket.connected) {
      handleConnect();
    } else {
      socket.connect();
    }

    return () => {
      const channelId = selectedChannelRef.current;
      if (channelId) {
        socket.emit("channel:leave", { channelId });
      }
      socket.off("messages:event", handleEvent);
      socket.off("connect", handleConnect);
      socket.disconnect();
    };
  }, [factory]);

  useEffect(() => {
    const socket = factory();
    if (selectedChannelId && socket.connected) {
      socket.emit("channel:join", { channelId: selectedChannelId });
    }
    return () => {
      if (selectedChannelId && socket.connected) {
        socket.emit("channel:leave", { channelId: selectedChannelId });
      }
    };
  }, [factory, selectedChannelId]);
}
