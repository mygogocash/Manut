import {
  MESSAGES_SOCKET_PATH,
  parseMessagesLiveEvent,
  type MessagesLiveEvent,
} from "@manut/app-core";
import { io } from "socket.io-client";

import { getMessagesSocketAuth } from "./messages-socket-auth";
import { getMessagesSocketUrl } from "./messages-socket-origin";

export type MessagesSocketStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "error"
  | "closed";

export interface MessagesRealtimeSocket {
  connected: boolean;
  connect: () => void;
  disconnect: () => void;
  emit: (event: string, ...args: unknown[]) => void;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  off: (event: string, handler: (...args: unknown[]) => void) => void;
}

export type MessagesSocketFactory = (
  url: string,
  options: {
    path: string;
    transports: string[];
    withCredentials: boolean;
    autoConnect: boolean;
    auth?: { token: string };
  },
) => MessagesRealtimeSocket;

export interface JoinMessagesChannelOptions {
  channelId: string;
  onEvent: (event: MessagesLiveEvent) => void;
  onStatus?: (status: MessagesSocketStatus) => void;
  onError?: (message: string) => void;
  resolveUrl?: () => string | null;
  resolveAuth?: () => Promise<{ withCredentials: boolean; token?: string }>;
  createSocket?: MessagesSocketFactory;
}

export interface MessagesChannelClient {
  readonly status: MessagesSocketStatus;
  close(): void;
}

const defaultFactory: MessagesSocketFactory = (url, options) =>
  io(url, options) as unknown as MessagesRealtimeSocket;

/**
 * Join a shared channel on the Express socket.io `/messages` namespace.
 * Live events come from messageBus; REST remains authoritative for history.
 */
export function joinMessagesChannel(
  options: JoinMessagesChannelOptions,
): MessagesChannelClient {
  let status: MessagesSocketStatus = "connecting";
  let socket: MessagesRealtimeSocket | null = null;
  let closed = false;

  const setStatus = (next: MessagesSocketStatus) => {
    status = next;
    options.onStatus?.(next);
  };

  const resolveUrl = options.resolveUrl ?? getMessagesSocketUrl;
  const resolveAuth = options.resolveAuth ?? getMessagesSocketAuth;
  const createSocket = options.createSocket ?? defaultFactory;

  options.onStatus?.(status);

  void (async () => {
    const url = resolveUrl();
    if (!url) {
      setStatus("error");
      options.onError?.(
        "Messages socket URL is not configured (set EXPO_PUBLIC_SOCKET_URL or EXPO_PUBLIC_API_URL).",
      );
      return;
    }
    if (closed) return;

    let auth: { withCredentials: boolean; token?: string };
    try {
      auth = await resolveAuth();
    } catch {
      if (closed) return;
      setStatus("error");
      options.onError?.("Could not resolve messages socket credentials.");
      return;
    }
    if (closed) return;

    const instance = createSocket(url, {
      path: MESSAGES_SOCKET_PATH,
      transports: ["websocket"],
      withCredentials: auth.withCredentials,
      autoConnect: false,
      ...(auth.token ? { auth: { token: auth.token } } : {}),
    });
    socket = instance;

    const handleEvent = (raw: unknown) => {
      const event = parseMessagesLiveEvent(raw);
      if (!event) return;
      if (event.channelId !== options.channelId) return;
      options.onEvent(event);
    };

    const handleConnect = () => {
      setStatus("connected");
      instance.emit("channel:join", { channelId: options.channelId });
    };

    const handleDisconnect = () => {
      if (!closed) setStatus("closed");
    };

    const handleConnectError = () => {
      setStatus("error");
      options.onError?.("Messages socket connection failed.");
    };

    instance.on("messages:event", handleEvent);
    instance.on("connect", handleConnect);
    instance.on("disconnect", handleDisconnect);
    instance.on("connect_error", handleConnectError);

    if (instance.connected) {
      handleConnect();
    } else {
      instance.connect();
    }
  })();

  return {
    get status() {
      return status;
    },
    close() {
      closed = true;
      if (socket) {
        socket.emit("channel:leave", { channelId: options.channelId });
        socket.disconnect();
      }
      socket = null;
      setStatus("closed");
    },
  };
}
