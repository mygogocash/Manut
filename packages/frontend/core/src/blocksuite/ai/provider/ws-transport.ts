/**
 * Manut M1 — Epic E1.11: WebSocket transport for AI chat.
 *
 * Drop-in replacement for the SSE EventSource used by `request.ts`. Exposes
 * the same `AsyncIterable<AffineTextEvent>` shape so the join layer in
 * request.ts (with its v1.10.1 SSE-stream-object scar — JSON-parse each
 * data chunk, extract textDelta, ignore reasoning/tool-call/tool-result)
 * keeps working byte-for-byte regardless of transport.
 *
 * Library choice
 * --------------
 * We use socket.io-client (already in @affine/core/package.json — no
 * incremental bundle cost) because:
 *   1. NestJS gateways speak the socket.io protocol natively (the
 *      backend uses `@nestjs/platform-socket.io`). Bringing up our own
 *      framing on raw WS would require a parallel server adapter.
 *   2. Namespace routing, automatic reconnect with exponential backoff,
 *      and ack-style request/response semantics come for free.
 *   3. Code-split: this module is dynamically imported by `request.ts`
 *      only when the `ws_transport` flag is on, so the SSE-only build
 *      pays nothing.
 *
 * Auto-reconnect: socket.io's built-in reconnect ramps from 1s -> 5s
 * with 5 attempts by default. We cap at 5 attempts to match the plan
 * spec; further failure surfaces as a hard error to the caller (same
 * shape as `RequestTimeoutError` / `GeneralNetworkError`).
 *
 * Cancel semantics: signal.abort() closes the socket and drains the
 * iterator. The server's `cancel` event tears down the upstream stream
 * (deferred wiring in chat.gateway.ts).
 */

import type { AffineTextEvent } from './event-source';

/**
 * Server-emitted StreamObject shape — same as backend
 * `providers/types.ts` StreamObjectSchema. The frontend request.ts
 * parser expects each `data` field of an AffineTextEvent to be the
 * JSON-serialised form of one of these objects (matching the SSE
 * v1.10.1 contract).
 */
type StreamObject =
  | { type: 'text-delta'; textDelta: string }
  | { type: 'reasoning'; textDelta: string }
  | {
      type: 'tool-call';
      toolCallId: string;
      toolName: string;
      args: Record<string, unknown>;
    }
  | {
      type: 'tool-result';
      toolCallId: string;
      toolName: string;
      args: Record<string, unknown>;
      result: unknown;
    };

interface TokenDeltaPayload {
  content: string;
}
interface ReasoningPayload {
  content: string;
}
interface ToolCallStartPayload {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
}
interface ToolCallResultPayload {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  result: unknown;
}
interface ErrorPayload {
  message: string;
  code?: string;
}

const WS_NAMESPACE = '/copilot-chat';

// Mirrors backend chat.events.ts WS_CHAT_EVENTS — kept as string literals
// here to avoid pulling backend types into the frontend.
const EV = {
  TOKEN_DELTA: 'token-delta',
  REASONING: 'reasoning',
  TOOL_CALL_START: 'tool-call-start',
  TOOL_CALL_RESULT: 'tool-call-result',
  MEMORY_PUSHED: 'memory-pushed',
  DONE: 'done',
  ERROR: 'error',
} as const;

const MAX_RECONNECT_ATTEMPTS = 5;

export interface ChatWebSocketOptions {
  sessionId: string;
  signal?: AbortSignal;
  timeout?: number;
  /**
   * URL of the socket.io endpoint. Defaults to a same-origin connection
   * (which the AFFiNE Caddy / Express stack proxies onto the backend
   * `/socket.io` mount). Override for local dev or tests.
   */
  url?: string;
}

/**
 * Open a WebSocket transport for the given chat session and return an
 * async iterable that yields the same `{ type: 'message', data: <json> }`
 * shape as `toTextStream`. The caller (request.ts) parses each `data`
 * payload identically for both transports.
 *
 * The returned object also exposes `close()` so request.ts can release
 * the socket on signal.abort() — mirrors `EventSource.close()`.
 */
export function chatWebSocketStream(
  options: ChatWebSocketOptions
): AsyncIterable<AffineTextEvent> & { close: () => void } {
  let closed = false;
  let close: () => void = () => {
    closed = true;
  };

  const iterable: AsyncIterable<AffineTextEvent> = {
    [Symbol.asyncIterator]: async function* () {
      // Dynamic import keeps socket.io-client out of the non-WS build.
      const { io } = await import('socket.io-client');

      const url = options.url ?? `${window.location.origin}${WS_NAMESPACE}`;
      const socket = io(url, {
        // `withCredentials` ensures the session cookie travels with the
        // handshake so the gateway's resolveUserId() finds it.
        withCredentials: true,
        reconnection: true,
        reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        // Force websocket transport — long-polling fallback is unnecessary
        // on modern infra and adds latency.
        transports: ['websocket'],
      });

      const queue: AffineTextEvent[] = [];
      let resolveNext: (() => void) | null = null;
      let rejectNext: ((err: Error) => void) | null = null;
      let pending = new Promise<void>((resolve, reject) => {
        resolveNext = resolve;
        rejectNext = reject;
      });

      const resetPending = () => {
        pending = new Promise<void>((resolve, reject) => {
          resolveNext = resolve;
          rejectNext = reject;
        });
      };

      const pushEvent = (payload: StreamObject) => {
        queue.push({ type: 'message', data: JSON.stringify(payload) });
        resolveNext?.();
        resetPending();
      };

      const pushError = (err: Error) => {
        rejectNext?.(err);
        resetPending();
      };

      const pushDone = () => {
        closed = true;
        resolveNext?.();
        resetPending();
      };

      socket.on('connect', () => {
        // Subscribe to the session room on every (re)connect so a
        // reconnect mid-stream picks up where the server left off.
        socket.emit(
          'subscribe',
          { sessionId: options.sessionId },
          (ack: { ok: boolean; error?: string } | undefined) => {
            if (!ack?.ok) {
              pushError(
                new Error(
                  `ws-transport: subscribe failed (${ack?.error ?? 'unknown'})`
                )
              );
            }
          }
        );
      });

      socket.on(EV.TOKEN_DELTA, (payload: TokenDeltaPayload) => {
        if (typeof payload?.content === 'string') {
          pushEvent({ type: 'text-delta', textDelta: payload.content });
        }
      });

      socket.on(EV.REASONING, (payload: ReasoningPayload) => {
        if (typeof payload?.content === 'string') {
          pushEvent({ type: 'reasoning', textDelta: payload.content });
        }
      });

      socket.on(EV.TOOL_CALL_START, (payload: ToolCallStartPayload) => {
        if (payload?.toolName && payload?.toolCallId) {
          pushEvent({
            type: 'tool-call',
            toolCallId: payload.toolCallId,
            toolName: payload.toolName,
            args: payload.args ?? {},
          });
        }
      });

      socket.on(EV.TOOL_CALL_RESULT, (payload: ToolCallResultPayload) => {
        if (payload?.toolName && payload?.toolCallId) {
          pushEvent({
            type: 'tool-result',
            toolCallId: payload.toolCallId,
            toolName: payload.toolName,
            args: payload.args ?? {},
            result: payload.result,
          });
        }
      });

      socket.on(EV.DONE, () => {
        pushDone();
      });

      socket.on(EV.ERROR, (payload: ErrorPayload) => {
        pushError(new Error(payload?.message ?? 'ws-transport: server error'));
      });

      socket.on('disconnect', (reason: string) => {
        // 'io server disconnect' = server-side close, no auto-reconnect.
        // Other reasons trigger socket.io's built-in reconnect logic.
        if (reason === 'io server disconnect') {
          pushDone();
        }
      });

      // After `reconnectionAttempts` exhausted, socket.io stops trying.
      socket.io.on('reconnect_failed', () => {
        pushError(new Error('ws-transport: reconnection attempts exhausted'));
      });

      // Plumb signal.abort -> socket.disconnect.
      const onAbort = () => {
        socket.emit('cancel', {});
        socket.disconnect();
        pushDone();
      };
      if (options.signal) {
        if (options.signal.aborted) {
          onAbort();
        } else {
          options.signal.addEventListener('abort', onAbort, { once: true });
        }
      }

      close = () => {
        if (closed) return;
        closed = true;
        try {
          socket.emit('cancel', {});
        } catch {
          // socket might already be torn down — ignore.
        }
        socket.disconnect();
        resolveNext?.();
      };

      try {
        while (!closed) {
          if (queue.length === 0) {
            const timeoutMs = options.timeout;
            if (timeoutMs && timeoutMs > 0) {
              await Promise.race([
                pending,
                new Promise<void>((_resolve, reject) =>
                  setTimeout(
                    () => reject(new Error('ws-transport: stream timeout')),
                    timeoutMs
                  )
                ),
              ]);
            } else {
              await pending;
            }
          }
          while (queue.length > 0) {
            const event = queue.shift();
            if (event) yield event;
          }
        }
      } finally {
        if (options.signal && !options.signal.aborted) {
          options.signal.removeEventListener('abort', onAbort);
        }
        try {
          socket.disconnect();
        } catch {
          // best effort
        }
      }
    },
  };

  return {
    [Symbol.asyncIterator]: iterable[Symbol.asyncIterator].bind(iterable),
    close: () => close(),
  };
}
