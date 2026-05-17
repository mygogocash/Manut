import { Subject } from 'rxjs';

import type { MnApprovalSseEvent } from './types';

/**
 * Frontend subscriber for the approvals SSE stream
 * (`/api/workspace/:workspaceId/approvals-stream`). Mirrors the
 * `doc-read-stream` pattern in shape and reconnection behaviour
 * (see CLAUDE.md §6e for the parent infra writeup).
 *
 * One subscriber per workspace. Internally maintains a single
 * `EventSource` while there's at least one subscriber, reopens with
 * exponential backoff on transport error, and tears down when the
 * last subscriber unsubscribes.
 *
 * Defensive against the v1.10.1 SSE-stream-object trap: every event
 * is JSON-parsed inside a try/catch; malformed frames don't crash
 * the consumer and don't leak SSE-wrapper fragments downstream.
 */
const PING_OP_SENTINEL = '__ping__';

interface MnApprovalsSseSubscriberOptions {
  /** Override for tests; defaults to `window.EventSource`. */
  readonly eventSourceFactory?: (url: string) => EventSource;
  /** Override for tests; defaults to `globalThis.setTimeout`. */
  readonly setTimeoutImpl?: typeof setTimeout;
}

const MIN_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;

export class MnApprovalsSseService {
  // Finnish notation ($) — repo convention enforced by oxlint's
  // rxjs/finnish rule.
  readonly events$ = new Subject<MnApprovalSseEvent>();

  private readonly workspaceId: string;
  private readonly factory: (url: string) => EventSource;
  private readonly setTimeoutImpl: typeof setTimeout;
  private source: EventSource | null = null;
  private backoffMs = MIN_BACKOFF_MS;
  private subscriberCount = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    workspaceId: string,
    options: MnApprovalsSseSubscriberOptions = {}
  ) {
    this.workspaceId = workspaceId;
    this.factory =
      options.eventSourceFactory ??
      ((url: string) => new EventSource(url, { withCredentials: true }));
    this.setTimeoutImpl = options.setTimeoutImpl ?? setTimeout;
  }

  /**
   * Returns a cleanup function. The first subscribe opens the stream;
   * the last unsubscribe closes it.
   */
  subscribe(): () => void {
    this.subscriberCount += 1;
    if (this.subscriberCount === 1) {
      this.open();
    }
    return () => {
      this.subscriberCount -= 1;
      if (this.subscriberCount <= 0) {
        this.subscriberCount = 0;
        this.close();
      }
    };
  }

  private open(): void {
    if (this.source) return;
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    const url = `/api/workspace/${encodeURIComponent(this.workspaceId)}/approvals-stream`;
    const source = this.factory(url);
    this.source = source;
    source.onopen = () => {
      // Reset backoff after a successful open. The server's first
      // ping ack means we're connected and any subsequent close is
      // genuinely a new failure.
      this.backoffMs = MIN_BACKOFF_MS;
    };
    source.onmessage = ev => {
      this.handleMessage(ev);
    };
    source.onerror = () => {
      this.handleError();
    };
  }

  private handleMessage(ev: MessageEvent<string>): void {
    if (!ev.data) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(ev.data);
    } catch {
      // Defensive: don't leak SSE-wrapper fragments to subscribers.
      return;
    }
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'op' in parsed &&
      (parsed as { op: string }).op === PING_OP_SENTINEL
    ) {
      // Server-sent keep-alive. Pings are unique; we don't propagate
      // them to subscribers.
      return;
    }
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'approvalId' in parsed &&
      'workspaceId' in parsed &&
      'op' in parsed
    ) {
      this.events$.next(parsed as MnApprovalSseEvent);
    }
  }

  private handleError(): void {
    // EventSource auto-reconnects, but only with a 3s exponential
    // browser-default that we can't tune. Be explicit so backoff
    // stays under our control.
    if (this.source) {
      this.source.close();
      this.source = null;
    }
    if (this.subscriberCount === 0) return;
    const delay = this.backoffMs;
    this.backoffMs = Math.min(this.backoffMs * 2, MAX_BACKOFF_MS);
    this.reconnectTimer = this.setTimeoutImpl(() => {
      this.reconnectTimer = null;
      if (this.subscriberCount === 0) return;
      this.open();
    }, delay);
  }

  private close(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.source) {
      this.source.close();
      this.source = null;
    }
    this.backoffMs = MIN_BACKOFF_MS;
  }
}
