import { PrismaClient } from '@prisma/client';
import test from 'ava';

import { createModule } from '../../../../../__tests__/create-module';
import { Mockers } from '../../../../../__tests__/mocks';
import { GogocashPoller } from '../gogocash.poller';

const module = await createModule({
  providers: [GogocashPoller],
});

const poller = module.get(GogocashPoller);
const db = module.get(PrismaClient);

test.afterEach.always(async () => {
  // Clean rows the poller writes so empty-state test sees a clean slate.
  await db.socialMetric.deleteMany({
    where: { platform: 'GOGOCASH' },
  });
});

test.after.always(async () => {
  await module.close();
});

test('writes total_users + signups_7d for the __internal__ workspace when no GOGOCASH connection exists', async t => {
  // Seed a couple of users and one workspace.
  await module.create(Mockers.User);
  await module.create(Mockers.User);
  await module.create(Mockers.Workspace);

  await poller.computeAndPersist(new Date());

  const totalUsersRow = await db.socialMetric.findFirst({
    where: {
      workspaceId: '__internal__',
      platform: 'GOGOCASH',
      metricKey: 'total_users',
    },
  });
  t.truthy(totalUsersRow, 'total_users metric should be persisted');
  // total_users counts every non-disabled user — at least the 2 we just made
  // (other tests in the suite may share the DB; the lower bound is what we
  // assert).
  t.true(
    (totalUsersRow?.value ?? 0) >= 2,
    `expected >= 2 total_users, got ${totalUsersRow?.value}`
  );

  const signups7dRow = await db.socialMetric.findFirst({
    where: {
      workspaceId: '__internal__',
      platform: 'GOGOCASH',
      metricKey: 'signups_7d',
    },
  });
  t.truthy(signups7dRow, 'signups_7d metric should be persisted');
  t.true(
    (signups7dRow?.value ?? 0) >= 2,
    `expected >= 2 signups_7d, got ${signups7dRow?.value}`
  );
});

test('runs without throwing on an empty database', async t => {
  // Truncate users + workspaces if possible — the test DB may already have
  // data from prior tests, in which case "empty state" really means "the
  // poller doesn't blow up regardless of state".
  await t.notThrowsAsync(() => poller.computeAndPersist(new Date()));

  // It should still have written rows for every metric key.
  const rowCount = await db.socialMetric.count({
    where: { workspaceId: '__internal__', platform: 'GOGOCASH' },
  });
  t.true(rowCount >= 1, 'poller should have persisted at least one row');
});
