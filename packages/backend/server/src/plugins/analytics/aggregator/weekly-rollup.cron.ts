import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

/**
 * Roll up the previous ISO week (Mon–Sun) into social_metrics rows
 * (bucket = WEEK). Runs Monday 03:00 UTC; feeds the weekly AI strategist.
 */
@Injectable()
export class WeeklyRollupCron {
  private readonly logger = new Logger(WeeklyRollupCron.name);

  // TODO(phase-3): aggregate prev-week events into SocialMetric rows.
  @Cron('0 3 * * 1')
  async run(): Promise<void> {
    this.logger.debug('WeeklyRollupCron.run: not yet implemented');
    throw new Error('NOT_IMPLEMENTED: WeeklyRollupCron.run');
  }
}
