import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

/**
 * Roll up the previous hour of social_events into social_metrics rows
 * (bucket = HOUR). Idempotent — re-running rewrites the same bucketStart.
 */
@Injectable()
export class HourlyRollupCron {
  private readonly logger = new Logger(HourlyRollupCron.name);

  // TODO(phase-3): aggregate prev-hour events into SocialMetric rows.
  @Cron('0 * * * *')
  async run(): Promise<void> {
    this.logger.debug('HourlyRollupCron.run: not yet implemented');
    throw new Error('NOT_IMPLEMENTED: HourlyRollupCron.run');
  }
}
