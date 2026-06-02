import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { MetricRollupService } from './metric-rollup.service';

/**
 * Roll up the previous hour of social_events into social_metrics rows
 * (bucket = HOUR). Idempotent — re-running rewrites the same bucketStart.
 */
@Injectable()
export class HourlyRollupCron {
  private readonly logger = new Logger(HourlyRollupCron.name);

  constructor(private readonly rollups: MetricRollupService) {}

  @Cron('0 * * * *')
  async run(now = new Date()): Promise<void> {
    const count = await this.rollups.rollupPreviousHour(now);
    this.logger.debug(`HourlyRollupCron.run: upserted ${count} metric rows`);
  }
}
