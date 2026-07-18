import {
  buildRealtimeRoomWebSocketUrl,
  parseRealtimeServerMessage,
  type RealtimeServerMessage,
} from "@manut/app-core";

export type RealtimeRoomStatus =
  | "idle"
  | "connecting"
  | "ready"
  | "error"
  | "closed";

export interface RealtimeRoomClient {
  readonly status: RealtimeRoomStatus;
  readonly lastError: string | null;
  readonly lastMessage: RealtimeServerMessage | null;
  close(): void;
  ping(id?: string): void;
}

export interface RealtimeRoomJoinOptions {
  origin: string;
  roomId: string;
  /** Native bearer token; web cookie auth relies on same-origin WS. */
  accessToken?: string | null;
  onStatus?: (status: RealtimeRoomStatus) => void;
  onMessage?: (message: RealtimeServerMessage) => void;
  onError?: (message: string) => void;
  createSocket?: (
    url: string,
    protocols?: string | string[],
    options?: { headers?: Record<string, string> },
  ) => WebSocket;
}

/**
 * Join an edge RealtimeRoom over WebSocket.
 * Does not deliver authoritative chat history — use REST for that.
 */
export function joinRealtimeRoom(
  options: RealtimeRoomJoinOptions,
): RealtimeRoomClient {
  const url = buildRealtimeRoomWebSocketUrl(options.origin, options.roomId);
  let status: RealtimeRoomStatus = "connecting";
  let lastError: string | null = null;
  let lastMessage: RealtimeServerMessage | null = null;

  const setStatus = (next: RealtimeRoomStatus) => {
    status = next;
    options.onStatus?.(next);
  };

  const headers =
    options.accessToken != null && options.accessToken.length > 0
      ? { Authorization: `Bearer ${options.accessToken}` }
      : undefined;

  const createSocket =
    options.createSocket ??
    ((socketUrl: string, _protocols?: string | string[], socketOptions?: {
      headers?: Record<string, string>;
    }) => {
      if (socketOptions?.headers) {
        // React Native WebSocket accepts a headers bag as the 3rd argument.
        return new (WebSocket as unknown as {
          new (
            url: string,
            protocols?: string | string[],
            options?: { headers?: Record<string, string> },
          ): WebSocket;
        })(socketUrl, undefined, socketOptions);
      }
      return new WebSocket(socketUrl);
    });

  let socket: WebSocket;
  try {
    socket = createSocket(url, undefined, headers ? { headers } : undefined);
  } catch (error) {
    lastError =
      error instanceof Error ? error.message : "Failed to open WebSocket.";
    setStatus("error");
    options.onError?.(lastError);
    return {
      get status() {
        return status;
      },
      get lastError() {
        return lastError;
      },
      get lastMessage() {
        return lastMessage;
      },
      close() {},
      ping() {},
    };
  }

  socket.addEventListener("open", () => {
    // Wait for the DO `ready` frame before advertising ready.
  });

  socket.addEventListener("message", (event) => {
    const raw = typeof event.data === "string" ? event.data : String(event.data);
    const parsed = parseRealtimeServerMessage(raw);
    if (!parsed) return;
    lastMessage = parsed;
    options.onMessage?.(parsed);
    if (parsed.type === "ready") {
      setStatus("ready");
    }
  });

  socket.addEventListener("error", () => {
    lastError = "Realtime room connection failed.";
    setStatus("error");
    options.onError?.(lastError);
  });

  socket.addEventListener("close", () => {
    if (status !== "error") setStatus("closed");
  });

  return {
    get status() {
      return status;
    },
    get lastError() {
      return lastError;
    },
    get lastMessage() {
      return lastMessage;
    },
    close() {
      try {
        socket.close(1000, "client close");
      } catch {
        // ignore
      }
      setStatus("closed");
    },
    ping(id = "probe") {
      if (socket.readyState !== WebSocket.OPEN) return;
      socket.send(JSON.stringify({ type: "ping", id }));
    },
  };
}
