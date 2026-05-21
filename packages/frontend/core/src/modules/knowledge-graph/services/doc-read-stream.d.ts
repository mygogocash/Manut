import type { EventSourceService } from '@affine/core/modules/cloud';
import type { ActivationBus } from './activation-bus';
/**
 * Subscribes to the backend SSE stream for AI doc-read events on `workspaceId`
 * and pushes every event into the given `bus`. Caller is responsible for
 * dedup (the bus handles it via `sourceId`).
 *
 * The URL is resolved against `ServerService.server.baseUrl` (via the passed
 * `eventSourceService`), so it works in desktop / custom-server contexts
 * where the API origin differs from `window.location.origin`. A plain
 * `new EventSource('/api/...')` would silently connect to the frontend
 * origin and the pulses would never arrive (Codex PR review on #44).
 *
 * Returns a disposer that closes the EventSource. Will auto-reconnect via
 * the EventSource native retry logic; if the endpoint 404s (backend doesn't
 * have the stream yet), we silently swallow — the graph view degrades
 * gracefully to a non-pulsing brain.
 */
export declare function subscribeDocReadStream(eventSourceService: EventSourceService, workspaceId: string, bus: Pick<ActivationBus, 'emit'>): () => void;
//# sourceMappingURL=doc-read-stream.d.ts.map