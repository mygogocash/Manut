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
export declare function chatWebSocketStream(options: ChatWebSocketOptions): AsyncIterable<AffineTextEvent> & {
    close: () => void;
};
//# sourceMappingURL=ws-transport.d.ts.map