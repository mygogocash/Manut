import { Injectable } from '@nestjs/common';
import type { SocialInsight } from '@prisma/client';
import { type Observable, ReplaySubject } from 'rxjs';
import { finalize } from 'rxjs/operators';

import type { SocialInsightObjectType } from './graphql/analytics.dto';
import { toInsightDto } from './graphql/overview';

export interface AnalyticsInsightEvent {
  workspaceId: string;
  insight: SocialInsightObjectType;
  /** Epoch milliseconds. */
  ts: number;
}

const REPLAY_BUFFER_SIZE = 100;
const REPLAY_WINDOW_MS = 60_000;

interface WorkspaceStream {
  // Finnish notation ($) — repo convention for RxJS streams.
  subject$: ReplaySubject<AnalyticsInsightEvent>;
  refcount: number;
  idleTimer?: NodeJS.Timeout;
}

function normalizeInsight(
  insight: SocialInsight | SocialInsightObjectType
): SocialInsightObjectType {
  if ('workspaceId' in insight) {
    return toInsightDto(insight);
  }
  return insight;
}

/**
 * Workspace-scoped pub/sub for live Analytics insight events.
 *
 * This intentionally mirrors the doc-read / approval SSE buses already used
 * in Manut: short replay for newly opened tabs, per-workspace isolation, and
 * refcount cleanup when the last subscriber disconnects.
 */
@Injectable()
export class AnalyticsInsightEventBus {
  private readonly streams = new Map<string, WorkspaceStream>();

  emit(
    workspaceId: string,
    insight: SocialInsight | SocialInsightObjectType
  ): void {
    const stream = this.getOrCreateStream(workspaceId);
    stream.subject$.next({
      workspaceId,
      insight: normalizeInsight(insight),
      ts: Date.now(),
    });
    if (stream.refcount === 0) {
      this.scheduleIdleCleanup(workspaceId, stream);
    }
  }

  subscribe(workspaceId: string): Observable<AnalyticsInsightEvent> {
    const stream = this.getOrCreateStream(workspaceId);
    stream.refcount += 1;
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

  /** Test hook; production code should not depend on this value. */
  activeWorkspaceCount(): number {
    return this.streams.size;
  }

  private getOrCreateStream(workspaceId: string): WorkspaceStream {
    const existing = this.streams.get(workspaceId);
    if (existing) return existing;
    const subject$ = new ReplaySubject<AnalyticsInsightEvent>(
      REPLAY_BUFFER_SIZE,
      REPLAY_WINDOW_MS
    );
    const created: WorkspaceStream = { subject$, refcount: 0 };
    this.streams.set(workspaceId, created);
    return created;
  }

  private releaseStream(workspaceId: string): void {
    const stream = this.streams.get(workspaceId);
    if (!stream) return;
    stream.refcount -= 1;
    if (stream.refcount <= 0) {
      this.disposeStream(workspaceId, stream);
    }
  }

  private scheduleIdleCleanup(
    workspaceId: string,
    stream: WorkspaceStream
  ): void {
    if (stream.idleTimer) clearTimeout(stream.idleTimer);
    stream.idleTimer = setTimeout(() => {
      const current = this.streams.get(workspaceId);
      if (!current || current.refcount > 0) return;
      this.disposeStream(workspaceId, current);
    }, REPLAY_WINDOW_MS);
    stream.idleTimer.unref?.();
  }

  private disposeStream(workspaceId: string, stream: WorkspaceStream): void {
    if (stream.idleTimer) clearTimeout(stream.idleTimer);
    stream.subject$.complete();
    this.streams.delete(workspaceId);
  }
}
