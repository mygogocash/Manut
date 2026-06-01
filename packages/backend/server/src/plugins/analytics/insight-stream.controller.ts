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

import { CurrentUser } from '../../core/auth';
import { AccessController } from '../../core/permission';
import { AnalyticsInsightEventBus } from './insight-event-bus.service';

interface AnalyticsInsightSseMessage {
  type: 'insight' | 'ping';
  data: string;
}

const PING_INTERVAL_MS = 5_000;

@Controller('/api/workspace/:workspaceId/analytics/insights-stream')
export class AnalyticsInsightsStreamController {
  private readonly logger = new Logger(AnalyticsInsightsStreamController.name);

  constructor(
    private readonly bus: AnalyticsInsightEventBus,
    private readonly ac: AccessController
  ) {}

  @Sse('')
  async stream(
    @CurrentUser() user: CurrentUser,
    @Param('workspaceId') workspaceId: string
  ): Promise<Observable<AnalyticsInsightSseMessage>> {
    await this.ac.user(user.id).workspace(workspaceId).assert('Workspace.Read');

    const close$ = new Subject<void>();

    const events$ = this.bus.subscribe(workspaceId).pipe(
      map(
        (event): AnalyticsInsightSseMessage => ({
          type: 'insight',
          data: JSON.stringify(event),
        })
      ),
      catchError((err: unknown) => {
        this.logger.error(
          `analytics insight stream error for workspace ${workspaceId}`,
          err
        );
        return of<AnalyticsInsightSseMessage>();
      }),
      finalize(() => {
        close$.next();
        close$.complete();
        this.logger.debug(
          `analytics insight stream closed for workspace ${workspaceId}`
        );
      })
    );

    const ping$ = interval(PING_INTERVAL_MS).pipe(
      map((): AnalyticsInsightSseMessage => ({ type: 'ping', data: '' })),
      takeUntil(close$)
    );

    return merge(events$, ping$);
  }
}
