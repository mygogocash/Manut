import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { MongoDbAggregationService } from './aggregation.service';

/**
 * Manut Analytics — daily-stats aggregation cron.
 *
 * Runs hourly and drives `runForWorkspace` against every workspace
 * that has at least one row in `mn_mongo_raw_data`. The ingestion cron
 * (15-min cadence) feeds raw rows; this cron rolls them up to daily
 * stats so the dashboard query (`dailyStats`) is fast.
 *
 * Why hourly (not 15-min like ingestion):
 *  - Aggregation reads ALL raw rows for the lookback window, so it's
 *    quadratically more expensive than ingestion per workspace.
 *  - Daily metrics don't need 15-min freshness — a 1-hour staleness
 *    window is well within the dashboard's expected SLA.
 *  - Hourly cadence × bounded concurrency (5) keeps Postgres CPU
 *    bounded even at 100+ workspaces.
 *
 * CLAUDE.md scars honoured:
 *  - `@Injectable()` on the cron class (v1.12.0 DI scar — without it
 *    NestJS won't emit `design:paramtypes` and the service injection
 *    resolves to `undefined`).
 *  - `MongoDbAggregationService` is a runtime import (no `import type`
 *    for a DI target — v1.12.0 scar).
 *  - Cron name is `'mongo-aggregation'` so the `@nestjs/schedule`
 *    registry doesn't collide with `'mongo-ingestion'`. Two crons
 *    with the same name silently overwrite each other in the schedule
 *    registry; one of them never fires.
 *
 * Operator override: `ENABLE_MONGO_AGGREGATION_CRON=false` short-circuits
 * the run so a degraded prod can opt out without a code change. Mirrors
 * the pattern used by `MongoDbIngestionCron`.
 */
const RUN_FOR_ALL_CONCURRENCY = 5;

@Injectable()
export class MongoDbAggregationCron {
  private readonly logger = new Logger(MongoDbAggregationCron.name);

  constructor(private readonly aggregation: MongoDbAggregationService) {}

  @Cron(CronExpression.EVERY_HOUR, { name: 'mongo-aggregation' })
  async run(): Promise<void> {
    if (process.env['ENABLE_MONGO_AGGREGATION_CRON'] === 'false') {
      this.logger.warn(
        'MongoDB aggregation cron disabled via ENABLE_MONGO_AGGREGATION_CRON=false'
      );
      return;
    }
    const start = Date.now();
    try {
      const workspaceIds = await this.aggregation.listWorkspacesWithRawData();
      if (workspaceIds.length === 0) {
        this.logger.log(
          JSON.stringify({
            event: 'mongo_aggregation_cron_complete',
            workspacesProcessed: 0,
            durationMs: Date.now() - start,
          })
        );
        return;
      }

      // Chunked Promise.allSettled — bounded concurrency keeps the
      // Postgres CPU bill predictable. allSettled means one workspace's
      // failure can't break the chain.
      for (let i = 0; i < workspaceIds.length; i += RUN_FOR_ALL_CONCURRENCY) {
        const chunk = workspaceIds.slice(i, i + RUN_FOR_ALL_CONCURRENCY);
        await Promise.allSettled(
          chunk.map(workspaceId =>
            this.aggregation.runForWorkspace(workspaceId).catch(err => {
              // Defensive — `runForWorkspace` shouldn't throw, but if it
              // does we log and swallow so the surrounding loop keeps
              // going. Per-workspace failures already emit their own
              // telemetry inside the service.
              this.logger.error(
                JSON.stringify({
                  event: 'mongo_aggregation_workspace_threw',
                  workspaceId,
                  message: err instanceof Error ? err.message : String(err),
                })
              );
            })
          )
        );
      }

      this.logger.log(
        JSON.stringify({
          event: 'mongo_aggregation_cron_complete',
          workspacesProcessed: workspaceIds.length,
          durationMs: Date.now() - start,
        })
      );
    } catch (err) {
      // Top-level throws are recovered so the cron stays alive for the
      // next tick. We've seen the ingestion cron survive a Postgres
      // hiccup this way; mirror that posture here.
      this.logger.error(
        JSON.stringify({
          event: 'mongo_aggregation_cron_threw',
          message: err instanceof Error ? err.message : String(err),
          durationMs: Date.now() - start,
        })
      );
    }
  }
}
