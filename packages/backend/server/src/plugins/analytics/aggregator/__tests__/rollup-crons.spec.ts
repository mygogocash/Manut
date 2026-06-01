import test from 'ava';
import Sinon from 'sinon';

import { DailyRollupCron } from '../daily-rollup.cron';
import { HourlyRollupCron } from '../hourly-rollup.cron';
import { WeeklyRollupCron } from '../weekly-rollup.cron';

test('Analytics rollup crons delegate to the metric rollup service', async t => {
  const now = new Date('2026-06-08T03:00:00Z');
  const service = {
    rollupPreviousHour: Sinon.stub().resolves(1),
    rollupPreviousDay: Sinon.stub().resolves(2),
    rollupPreviousWeek: Sinon.stub().resolves(3),
  };

  await new HourlyRollupCron(service as never).run(now);
  await new DailyRollupCron(service as never).run(now);
  await new WeeklyRollupCron(service as never).run(now);

  t.true(service.rollupPreviousHour.calledOnceWithExactly(now));
  t.true(service.rollupPreviousDay.calledOnceWithExactly(now));
  t.true(service.rollupPreviousWeek.calledOnceWithExactly(now));
});
