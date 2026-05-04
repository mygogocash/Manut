import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

/**
 * Roll up the previous calendar day of social_events into social_metrics
 * rows (bucket = DAY). Runs at 02:00 UTC after hourly rollups settle.
 */
@Injectable()
export class DailyRollupCron {
  private readonly logger = new Logger(DailyRollupCron.name);

  // TODO(phase-3): aggregate prev-day events into SocialMetric rows.
  @Cron('0 2 * * *')
  async run(): Promise<void> {
    this.logger.debug('DailyRollupCron.run: not yet implemented');
    throw new Error('NOT_IMPLEMENTED: DailyRollupCron.run');
  }
}
