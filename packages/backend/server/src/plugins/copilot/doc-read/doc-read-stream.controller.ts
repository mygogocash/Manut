/**
 * SSE endpoint that streams `DocReadEvent`s to the Knowledge Graph
 * frontend. One stream per workspace; every connected client receives
 * the same events.
 *
 * Auth: requires the caller to have `Workspace.Read` on the workspace.
 * The assert call happens BEFORE we subscribe so an unauthorised
 * client is rejected with the usual SpaceAccessDenied error and never
 * pollutes the bus refcount.
 *
 * Error & cleanup story:
 *   - rxjs `finalize` in DocReadEventBus.subscribe decrements the
 *     refcount when the HTTP connection closes, so leaks aren't
 *     possible even if the client drops mid-stream.
 *   - A 5s ping is interleaved into the stream so reverse proxies
 *     don't kill the connection during idle workspaces.
 */
import { Controller, Logger, Param, Sse } from '@nestjs/common';
import {
  catchError,
  finalize,
  interval,
  map,
  merge,
  type Observable,
  of,
  Subject,
  takeUntil,
} from 'rxjs';

import { CurrentUser } from '../../../core/auth';
import { AccessController } from '../../../core/permission';
import { DocReadEventBus } from './doc-read-event-bus.service';

interface DocReadSseMessage {
  type: 'doc-read' | 'ping';
  data: string;
}

const PING_INTERVAL_MS = 5_000;

@Controller('/api/workspace/:workspaceId/doc-read-stream')
export class DocReadStreamController {
  private readonly logger = new Logger(DocReadStreamController.name);

  constructor(
    private readonly bus: DocReadEventBus,
    private readonly ac: AccessController
  ) {}

  @Sse('')
  async stream(
    @CurrentUser() user: CurrentUser,
    @Param('workspaceId') workspaceId: string
  ): Promise<Observable<DocReadSseMessage>> {
    // Workspace ACL gate — throws SpaceAccessDenied if the caller is
    // not a workspace member. Must run BEFORE we hit the bus so an
    // unauthorised client never bumps the refcount.
    await this.ac.user(user.id).workspace(workspaceId).assert('Workspace.Read');

    // Sentinel that fires when the event stream completes so the
    // ping interval shuts down too (otherwise it would hold the
    // request open forever).
    const close$ = new Subject<void>();

    const events$ = this.bus.subscribe(workspaceId).pipe(
      map(
        (event): DocReadSseMessage => ({
          type: 'doc-read',
          data: JSON.stringify(event),
        })
      ),
      catchError((err: unknown) => {
        this.logger.error(
          `doc-read stream error for workspace ${workspaceId}`,
          err
        );
        // Swallow the error into a graceful close so the client
        // reconnects rather than seeing a network failure.
        return of<DocReadSseMessage>();
      }),
      finalize(() => {
        close$.next();
        close$.complete();
        this.logger.debug(
          `doc-read stream closed for workspace ${workspaceId}`
        );
      })
    );

    // Keep-alive ping so the SSE connection isn't killed by an
    // intermediate proxy during quiet periods. Shuts down when the
    // event stream finalises.
    const ping$ = interval(PING_INTERVAL_MS).pipe(
      map((): DocReadSseMessage => ({ type: 'ping', data: '' })),
      takeUntil(close$)
    );

    return merge(events$, ping$);
  }
}
