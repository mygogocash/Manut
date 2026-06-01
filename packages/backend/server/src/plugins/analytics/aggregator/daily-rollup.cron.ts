import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { MetricRollupService } from './metric-rollup.service';

/**
 * Roll up the previous calendar day's HOUR social_metrics into DAY rows.
 * Runs at 02:00 UTC after hourly rollups settle.
 */
@Injectable()
export class DailyRollupCron {
  private readonly logger = new Logger(DailyRollupCron.name);

  constructor(private readonly rollups: MetricRollupService) {}

  @Cron('0 2 * * *')
  async run(now = new Date()): Promise<void> {
    const count = await this.rollups.rollupPreviousDay(now);
    this.logger.debug(`DailyRollupCron.run: upserted ${count} metric rows`);
  }
}
