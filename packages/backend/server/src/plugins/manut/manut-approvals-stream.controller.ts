/**
 * SSE endpoint that streams `MnApprovalEvent`s for the approvals inbox
 * frontend. One stream per workspace; every connected client receives
 * every event. Mirrors `doc-read-stream.controller.ts` (see CLAUDE.md
 * §6e — same refcount + 5s-ping pattern).
 *
 * Auth: requires the caller to have `Workspace.Read` on the workspace.
 * The assert call happens BEFORE we subscribe so an unauthorised
 * client is rejected with the usual SpaceAccessDenied error and never
 * pollutes the bus refcount.
 *
 * Error & cleanup story:
 *   - rxjs `finalize` in `MnApprovalEventBus.subscribe` decrements the
 *     refcount when the HTTP connection closes, so leaks aren't
 *     possible even if the client drops mid-stream.
 *   - A 5s ping is interleaved into the stream so reverse proxies
 *     don't kill the connection during idle workspaces.
 */
import { Controller, Injectable, Logger, Param, Sse } from '@nestjs/common';
import {
  catchError,
  finalize,
  interval,
  map,
  merge,
  type Observable,
  of,
  ReplaySubject,
  Subject,
  takeUntil,
} from 'rxjs';

import { CurrentUser } from '../../core/auth';
import { AccessController } from '../../core/permission';

/**
 * Operation kind that triggered an approval event. Mirrors the
 * workflow vocab so the frontend can render a per-kind chip.
 */
export type MnApprovalEventOp =
  | 'created'
  | 'decided'
  | 'revision-requested'
  | 'resubmitted'
  | 'cancelled';

export interface MnApprovalEvent {
  approvalId: string;
  workspaceId: string;
  op: MnApprovalEventOp;
  /** Epoch milliseconds. */
  ts: number;
}

const REPLAY_BUFFER_SIZE = 100;
const REPLAY_WINDOW_MS = 60_000;
const PING_INTERVAL_MS = 5_000;

interface WorkspaceStream {
  // Finnish notation ($) — repo convention for RxJS streams enforced
  // by oxlint's rxjs/finnish rule.
  subject$: ReplaySubject<MnApprovalEvent>;
  refcount: number;
  idleTimer?: NodeJS.Timeout;
}

/**
 * Pub/sub bus that backs the SSE stream. Mirrors `DocReadEventBus`:
 * per-workspace `ReplaySubject` with refcount, idle cleanup via
 * timer, and a `finalize` hook on subscribe so the controller's
 * connection-close decrements the refcount.
 *
 * CLAUDE.md scars honored:
 *  - `@Injectable()` so TS emits `design:paramtypes` for NestJS DI.
 *  - No constructor params: dependency-free so it can be safely
 *    injected anywhere (including from `MnApprovalService` if/when
 *    we wire emit-on-create through the service).
 */
@Injectable()
export class MnApprovalEventBus {
  private readonly streams = new Map<string, WorkspaceStream>();

  /**
   * Push an approval event onto the workspace's stream. Lazy stream
   * creation so a subscriber arriving in the replay window still sees
   * recent events.
   */
  emit(workspaceId: string, event: MnApprovalEvent): void {
    const stream = this.getOrCreateStream(workspaceId);
    stream.subject$.next(event);
    if (stream.refcount === 0) {
      this.scheduleIdleCleanup(workspaceId, stream);
    }
  }

  /**
   * Subscribe to a workspace's approval-event stream. The returned
   * Observable replays up to `REPLAY_BUFFER_SIZE` events from the
   * past `REPLAY_WINDOW_MS` ms, then continues with live events.
   *
   * The caller MUST unsubscribe when done (the SSE controller's
   * `finalize` already does this; tests do it explicitly).
   */
  subscribe(workspaceId: string): Observable<MnApprovalEvent> {
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

  /**
   * Test hook: number of workspaces with at least one live subscriber
   * OR a pending idle cleanup. Not part of the public contract.
   */
  activeWorkspaceCount(): number {
    return this.streams.size;
  }

  private getOrCreateStream(workspaceId: string): WorkspaceStream {
    const existing = this.streams.get(workspaceId);
    if (existing) return existing;
    const subject$ = new ReplaySubject<MnApprovalEvent>(
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

interface MnApprovalSseMessage {
  type: 'approval' | 'ping';
  data: string;
}

@Controller('/api/workspace/:workspaceId/approvals-stream')
export class MnApprovalsStreamController {
  private readonly logger = new Logger(MnApprovalsStreamController.name);

  constructor(
    private readonly bus: MnApprovalEventBus,
    private readonly ac: AccessController
  ) {}

  @Sse('')
  async stream(
    @CurrentUser() user: CurrentUser,
    @Param('workspaceId') workspaceId: string
  ): Promise<Observable<MnApprovalSseMessage>> {
    // Workspace ACL gate — throws SpaceAccessDenied if the caller is
    // not a workspace member. MUST run BEFORE we hit the bus so an
    // unauthorised client never bumps the refcount.
    await this.ac.user(user.id).workspace(workspaceId).assert('Workspace.Read');

    const close$ = new Subject<void>();

    const events$ = this.bus.subscribe(workspaceId).pipe(
      map(
        (event): MnApprovalSseMessage => ({
          type: 'approval',
          data: JSON.stringify(event),
        })
      ),
      catchError((err: unknown) => {
        this.logger.error(
          `approval stream error for workspace ${workspaceId}`,
          err
        );
        return of<MnApprovalSseMessage>();
      }),
      finalize(() => {
        close$.next();
        close$.complete();
        this.logger.debug(
          `approval stream closed for workspace ${workspaceId}`
        );
      })
    );

    const ping$ = interval(PING_INTERVAL_MS).pipe(
      map((): MnApprovalSseMessage => ({ type: 'ping', data: '' })),
      takeUntil(close$)
    );

    return merge(events$, ping$);
  }
}
