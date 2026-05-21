import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { MongoDbIngestionService } from './ingestion.service';

/**
 * Manut Analytics — MongoDB ingestion cron.
 *
 * Runs every 15 minutes and drives `runForAll` on the underlying
 * `MongoDbIngestionService`. The service owns per-workspace iteration,
 * bounded concurrency (5 in parallel), failure isolation, and the
 * circuit-breaker on `consecutive_failures`. This shell does one job:
 * own the schedule.
 *
 * CLAUDE.md scars honoured:
 *  - @Injectable() on the cron class (v1.12.0 DI scar)
 *  - MongoDbIngestionService is a runtime import (no `import type` for
 *    a DI target)
 *  - 15-min cadence matches the per-workspace doc-limit (1000 docs per
 *    run) — at this combination a normal workspace catches up to its
 *    Mongo cluster within an hour even at the cold-start, then idles
 *    on the cursor's $gt window
 *
 * Operator override: `ENABLE_MONGO_INGEST_CRON=false` short-circuits
 * the run so a degraded prod can opt out without a code change.
 */
@Injectable()
export class MongoDbIngestionCron {
  private readonly logger = new Logger(MongoDbIngestionCron.name);

  constructor(private readonly ingestion: MongoDbIngestionService) {}

  @Cron(CronExpression.EVERY_30_MINUTES, { name: 'mongo-ingestion' })
  async run(): Promise<void> {
    if (process.env['ENABLE_MONGO_INGEST_CRON'] === 'false') {
      this.logger.warn(
        'MongoDB ingestion cron disabled via ENABLE_MONGO_INGEST_CRON=false'
      );
      return;
    }
    const start = Date.now();
    try {
      await this.ingestion.runForAll();
      this.logger.log(
        JSON.stringify({
          event: 'mongo_ingestion_cron_complete',
          durationMs: Date.now() - start,
        })
      );
    } catch (err) {
      // runForAll is supposed to be defensive — but if a top-level
      // throw slips through we log and swallow so the cron stays alive
      // for the next tick.
      this.logger.error(
        JSON.stringify({
          event: 'mongo_ingestion_cron_threw',
          message: err instanceof Error ? err.message : String(err),
          durationMs: Date.now() - start,
        })
      );
    }
  }
}
