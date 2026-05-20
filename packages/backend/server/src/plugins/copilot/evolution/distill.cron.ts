import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { DistillService } from './distill.service';

/**
 * Manut M2 E2.4 — Weekly distillation cron.
 *
 * Fires Sunday 00:00 UTC. Crontab: `0 0 * * 0` (minute=0 hour=0 of
 * Sunday). NestJS `@Cron` accepts standard 5-field crontab — the
 * existing analytics rollup crons (e.g. `WeeklyRollupCron @Cron('0 3 * *
 * 1')`) use the same shape, see `plugins/analytics/aggregator/`.
 *
 * The cron only fans out the work; the heavy lifting lives in
 * `DistillService.distillAllWorkspaces`. Splitting them lets tests hit
 * the service directly without booting the scheduler.
 *
 * Per CLAUDE.md DI-metadata scars: `@Injectable()` is mandatory so the
 * constructor `paramtypes` metadata gets emitted; otherwise NestJS
 * silently resolves `distill` to `undefined` and the cron crashes at
 * first firing.
 */
@Injectable()
export class DistillCron {
  private readonly logger = new Logger(DistillCron.name);

  constructor(private readonly distill: DistillService) {}

  // Sunday 00:00 UTC — the M2 plan specifies a weekly cadence. The
  // existing analytics crons schedule themselves Monday 03:00 UTC
  // (weekly), Tuesday 02:00 UTC (daily), 03:00 UTC (refresh), so the
  // Sunday-00:00 slot is clear of other heavy jobs.
  @Cron('0 0 * * 0')
  async run(): Promise<void> {
    try {
      const count = await this.distill.distillAllWorkspaces();
      this.logger.log(
        `DistillCron: weekly distillation complete — ${count} PLAYBOOK(s) upserted.`
      );
    } catch (error) {
      // Belt-and-braces — the service method already catches its own
      // errors, but a thrown exception out of the cron handler would
      // propagate to NestJS and pollute logs. Swallow + log.
      this.logger.error(
        `DistillCron: weekly run failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}
