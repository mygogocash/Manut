import test from 'ava';

import { DailyRollupCron } from '../daily-rollup.cron';
import { HourlyRollupCron } from '../hourly-rollup.cron';
import { WeeklyRollupCron } from '../weekly-rollup.cron';

test('Analytics rollup crons > given phase-3 rollups are not implemented > then scheduled runs do not throw', async t => {
  await t.notThrowsAsync(async () => {
    await new HourlyRollupCron().run();
    await new DailyRollupCron().run();
    await new WeeklyRollupCron().run();
  });
});
