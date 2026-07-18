import {
  parseMessagesLiveEvent,
  parseRealtimeServerMessage,
  type MessagesLiveEvent,
} from "@manut/app-core";

import {
  joinMessagesChannel,
  type JoinMessagesChannelOptions,
  type MessagesChannelClient,
  type MessagesSocketStatus,
} from "./messages-socket";
import { getMessagesSocketAuth } from "./messages-socket-auth";
import { getRealtimeOrigin } from "./realtime-origin";
import {
  joinRealtimeRoom,
  type RealtimeRoomClient,
  type RealtimeRoomJoinOptions,
} from "./realtime-room";

export type MessagesLiveTransport = "durable-object" | "socket.io";

export interface JoinMessagesLiveOptions extends JoinMessagesChannelOptions {
  resolveRealtimeOrigin?: () => string | null;
  /** Force socket.io (tests / diagnostics). */
  preferSocketIo?: boolean;
  onTransport?: (transport: MessagesLiveTransport) => void;
  createRealtimeSocket?: RealtimeRoomJoinOptions["createSocket"];
}

/**
 * Prefer edge Durable Object shared-channel WebSocket when an origin is
 * available; fall back to Express socket.io on missing origin or DO failure.
 */
export function joinMessagesLiveChannel(
  options: JoinMessagesLiveOptions,
): MessagesChannelClient {
  if (options.preferSocketIo) {
    options.onTransport?.("socket.io");
    return joinMessagesChannel(options);
  }

  const resolveOrigin =
    options.resolveRealtimeOrigin ?? (() => getRealtimeOrigin());
  const origin = resolveOrigin();
  if (!origin) {
    options.onTransport?.("socket.io");
    return joinMessagesChannel(options);
  }

  let status: MessagesSocketStatus = "connecting";
  let closed = false;
  let active: MessagesChannelClient | null = null;
  let doClient: RealtimeRoomClient | null = null;
  let fellBack = false;

  const setStatus = (next: MessagesSocketStatus) => {
    status = next;
    options.onStatus?.(next);
  };

  options.onStatus?.(status);

  const startSocketIoFallback = (reason: string) => {
    if (closed || fellBack) return;
    fellBack = true;
    doClient?.close();
    doClient = null;
    options.onTransport?.("socket.io");
    options.onError?.(reason);
    active = joinMessagesChannel({
      ...options,
      onStatus: (next) => {
        status = next;
        options.onStatus?.(next);
      },
    });
  };

  void (async () => {
    let accessToken: string | null | undefined;
    try {
      const auth =
        (await (options.resolveAuth ?? getMessagesSocketAuth)()) ?? {
          withCredentials: true,
        };
      accessToken = auth.token ?? null;
    } catch {
      if (!closed) {
        startSocketIoFallback("Could not resolve realtime credentials.");
      }
      return;
    }
    if (closed) return;

    options.onTransport?.("durable-object");
    doClient = joinRealtimeRoom({
      origin,
      roomId: options.channelId,
      accessToken,
      createSocket: options.createRealtimeSocket,
      onStatus: (roomStatus) => {
        if (closed || fellBack) return;
        if (roomStatus === "ready") {
          setStatus("connected");
          return;
        }
        if (roomStatus === "error") {
          startSocketIoFallback("Realtime Durable Object connection failed.");
          return;
        }
        if (roomStatus === "closed" && status === "connecting") {
          startSocketIoFallback("Realtime Durable Object closed before ready.");
        }
      },
      onMessage: (message) => {
        if (closed || fellBack) return;
        if (message.type !== "broadcast") return;
        const event = parseMessagesLiveEvent(message.payload);
        if (!event) return;
        if (event.channelId !== options.channelId) return;
        options.onEvent(event);
      },
      onError: () => {
        if (closed || fellBack) return;
        startSocketIoFallback("Realtime Durable Object connection failed.");
      },
    });

    // Defensive: if the adapter returned immediately in error state.
    if (doClient.status === "error") {
      startSocketIoFallback(
        doClient.lastError ?? "Realtime Durable Object connection failed.",
      );
    }
  })();

  return {
    get status() {
      return active?.status ?? status;
    },
    close() {
      closed = true;
      doClient?.close();
      doClient = null;
      active?.close();
      active = null;
      setStatus("closed");
    },
  };
}

/** Map a DO broadcast frame payload into a live messages event when possible. */
export function liveEventFromRealtimeBroadcast(
  rawFrame: string,
): MessagesLiveEvent | null {
  const frame = parseRealtimeServerMessage(rawFrame);
  if (!frame || frame.type !== "broadcast") return null;
  return parseMessagesLiveEvent(frame.payload);
}
