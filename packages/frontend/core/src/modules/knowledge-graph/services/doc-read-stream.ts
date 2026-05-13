import type { ActivationBus, DocReadActivation } from './activation-bus';

/**
 * Validates the SSE payload shape at the trust boundary. The server's TS
 * types are nominally compatible, but we treat anything coming off the
 * network as `unknown` per the coding style.
 */
function parseEvent(raw: unknown): DocReadActivation | null {
  if (!raw || typeof raw !== 'object') return null;
  const e = raw as Record<string, unknown>;
  if (
    typeof e.docId === 'string' &&
    typeof e.workspaceId === 'string' &&
    typeof e.sourceId === 'string' &&
    typeof e.op === 'string' &&
    typeof e.ts === 'number'
  ) {
    return {
      docId: e.docId,
      workspaceId: e.workspaceId,
      sourceId: e.sourceId,
      op: e.op as DocReadActivation['op'],
      agentId: typeof e.agentId === 'string' ? e.agentId : undefined,
      ts: e.ts,
    };
  }
  return null;
}

/**
 * Subscribes to the backend SSE stream for AI doc-read events on `workspaceId`
 * and pushes every event into the given `bus`. Caller is responsible for
 * dedup (the bus handles it via `sourceId`).
 *
 * Returns a disposer that closes the EventSource. Will auto-reconnect via
 * the EventSource native retry logic; if the endpoint 404s (backend doesn't
 * have the stream yet), we silently swallow — Phase 2 backend may ship after
 * the frontend in dev environments and that's fine for a v0.
 */
export function subscribeDocReadStream(
  workspaceId: string,
  bus: Pick<ActivationBus, 'emit'>
): () => void {
  if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
    // SSR / test environment — nothing to do.
    return () => {};
  }

  const url = `/api/workspace/${encodeURIComponent(workspaceId)}/doc-read-stream`;
  let source: EventSource | null;
  try {
    source = new EventSource(url, { withCredentials: true });
  } catch {
    // EventSource construction can throw on some browsers in privacy modes
    // — fail soft, the graph still works without pulses.
    return () => {};
  }

  const onMessage = (raw: MessageEvent<string>) => {
    try {
      const parsed = JSON.parse(raw.data);
      const event = parseEvent(parsed);
      if (event && event.workspaceId === workspaceId) {
        bus.emit(event);
      }
    } catch {
      // Malformed payload — drop. The stream itself stays alive.
    }
  };

  // The backend emits with `type: 'doc-read'` per the SSE spec. EventSource
  // dispatches typed events as well as generic 'message' events for
  // untyped payloads. Listen to both so we're robust to either backend
  // implementation.
  source.addEventListener('doc-read', onMessage as EventListener);
  source.onmessage = onMessage;
  source.onerror = () => {
    // EventSource handles reconnect itself. We don't log because the
    // backend may not be present yet in dev. If it stays errored, the
    // browser dev tools will surface the network failure.
  };

  return () => {
    source?.close();
    source = null;
  };
}
