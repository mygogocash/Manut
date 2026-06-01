import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { MetricRollupService } from './metric-rollup.service';

/**
 * Roll up the previous ISO week's DAY social_metrics into WEEK rows.
 * Runs Monday 03:00 UTC; feeds the weekly AI strategist.
 */
@Injectable()
export class WeeklyRollupCron {
  private readonly logger = new Logger(WeeklyRollupCron.name);

  constructor(private readonly rollups: MetricRollupService) {}

  @Cron('0 3 * * 1')
  async run(now = new Date()): Promise<void> {
    const count = await this.rollups.rollupPreviousWeek(now);
    this.logger.debug(`WeeklyRollupCron.run: upserted ${count} metric rows`);
  }
}
