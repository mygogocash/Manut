/**
 * DocReadEventBus — workspace-scoped pub/sub for AI-driven doc reads.
 *
 * Feeds the Knowledge Graph "activation pulse" feature: every time a
 * copilot tool reads (or is about to edit) a workspace doc, a
 * DocReadEvent is emitted on the workspace's stream. The graph view
 * subscribes via SSE and animates a light pulse along the matching
 * edge.
 *
 * Implementation notes:
 *   - One `ReplaySubject<DocReadEvent>` per workspace (bufferSize=200,
 *     windowTime=60s) so a freshly-subscribing client immediately sees
 *     the most recent activity without waiting for the next tool call.
 *   - Refcount tracked per workspace; when the last subscriber leaves
 *     AND no replay window is needed, the subject is completed and
 *     released. We rely on rxjs `finalize` to keep refcount in sync.
 *   - All state is in-memory. This is intentional: pulses are visual
 *     and transient; durability is not required.
 */
import { Injectable } from '@nestjs/common';
import { type Observable, ReplaySubject } from 'rxjs';
import { finalize } from 'rxjs/operators';

/**
 * Operation kind that triggered a doc read.
 *
 * Mirrors the copilot tool names plus a sentinel `other` for any
 * future emitter that does not fit cleanly into one of the existing
 * tool buckets.
 */
export type DocReadOp =
  | 'searchWorkspace'
  | 'docRead'
  | 'readingDocs'
  | 'docEdit'
  | 'sectionEdit'
  | 'other';

export interface DocReadEvent {
  docId: string;
  workspaceId: string;
  /**
   * Deduplication key. Clients may pre-emit a pulse with the same
   * sourceId before the server confirms; the graph view ignores
   * duplicates.
   */
  sourceId: string;
  op: DocReadOp;
  /** Optional: chat session id, cron job name, agent label, etc. */
  agentId?: string;
  /** Epoch milliseconds. */
  ts: number;
}

/**
 * Per-workspace buffer config. 200 events / 60s window is enough to
 * paint a meaningful "what just happened" trail when a user opens the
 * graph view mid-flight.
 */
const REPLAY_BUFFER_SIZE = 200;
const REPLAY_WINDOW_MS = 60_000;

interface WorkspaceStream {
  // Finnish notation ($) — repo convention for RxJS streams enforced by eslint.
  subject$: ReplaySubject<DocReadEvent>;
  refcount: number;
  /**
   * When the stream has no live subscribers, we still keep the
   * ReplaySubject alive for `REPLAY_WINDOW_MS` so a client that
   * subscribes mid-burst sees recent activity. This timer drops the
   * stream if no one subscribes in that window.
   */
  idleTimer?: NodeJS.Timeout;
}

@Injectable()
export class DocReadEventBus {
  private readonly streams = new Map<string, WorkspaceStream>();

  /**
   * Push a doc-read event onto the workspace's stream. If no stream
   * exists yet, one is created lazily so a subscriber arriving within
   * the replay window still sees the burst. Streams with no
   * subscribers are garbage-collected after `REPLAY_WINDOW_MS`.
   *
   * Performance: O(1). Safe to call from hot paths (tool execute).
   */
  emit(workspaceId: string, event: DocReadEvent): void {
    const stream = this.getOrCreateStream(workspaceId);
    stream.subject$.next(event);
    // Ensure an idle stream is GC'd if it never gets a subscriber.
    if (stream.refcount === 0) {
      this.scheduleIdleCleanup(workspaceId, stream);
    }
  }

  /**
   * Subscribe to a workspace's stream. The returned Observable
   * replays up to the last 200 events from the past minute, then
   * continues with live events.
   *
   * The caller MUST unsubscribe when done (the SSE controller's
   * `finalize` already does this; tests do it explicitly).
   */
  subscribe(workspaceId: string): Observable<DocReadEvent> {
    const stream = this.getOrCreateStream(workspaceId);
    stream.refcount += 1;
    // Cancel any pending idle cleanup — we have an active subscriber now.
    if (stream.idleTimer) {
      clearTimeout(stream.idleTimer);
      stream.idleTimer = undefined;
    }

    return stream.subject$.asObservable().pipe(
      finalize(() => {
        this.releaseStream(workspaceId);
      })
    );
  }

  /**
   * Test hook: number of workspaces with at least one live subscriber
   * OR a pending idle cleanup. Not part of the public contract but
   * exported so unit tests can verify cleanup. Production code should
   * not depend on this value.
   */
  activeWorkspaceCount(): number {
    return this.streams.size;
  }

  private getOrCreateStream(workspaceId: string): WorkspaceStream {
    const existing = this.streams.get(workspaceId);
    if (existing) {
      return existing;
    }
    const subject$ = new ReplaySubject<DocReadEvent>(
      REPLAY_BUFFER_SIZE,
      REPLAY_WINDOW_MS
    );
    const created: WorkspaceStream = { subject$, refcount: 0 };
    this.streams.set(workspaceId, created);
    return created;
  }

  private releaseStream(workspaceId: string): void {
    const stream = this.streams.get(workspaceId);
    if (!stream) {
      return;
    }
    stream.refcount -= 1;
    if (stream.refcount <= 0) {
      // Tear down immediately on the last unsubscribe — keeps the
      // "fresh stream on resubscribe" contract that tests rely on.
      this.disposeStream(workspaceId, stream);
    }
  }

  private scheduleIdleCleanup(
    workspaceId: string,
    stream: WorkspaceStream
  ): void {
    if (stream.idleTimer) {
      clearTimeout(stream.idleTimer);
    }
    stream.idleTimer = setTimeout(() => {
      // If the workspace gained a subscriber in the meantime, leave it alone.
      const current = this.streams.get(workspaceId);
      if (!current || current.refcount > 0) {
        return;
      }
      this.disposeStream(workspaceId, current);
    }, REPLAY_WINDOW_MS);
    // Don't block the event loop on shutdown.
    stream.idleTimer.unref?.();
  }

  private disposeStream(workspaceId: string, stream: WorkspaceStream): void {
    if (stream.idleTimer) {
      clearTimeout(stream.idleTimer);
    }
    stream.subject$.complete();
    this.streams.delete(workspaceId);
  }
}
