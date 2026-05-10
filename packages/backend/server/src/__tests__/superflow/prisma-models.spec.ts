import { PrismaClient } from '@prisma/client';
import test from 'ava';

/**
 * Smoke test: Superflow tables are registered on the generated client.
 * Catches missing migrations / failed prisma generate in CI.
 */
test('Prisma client exposes Superflow Sf* model delegates', t => {
  const prisma = new PrismaClient();
  t.truthy(prisma.sfProject);
  t.truthy(prisma.sfProjectMember);
  t.truthy(prisma.sfTask);
  t.truthy(prisma.sfTaskComment);
  t.truthy(prisma.sfTaskActivity);
  t.truthy(prisma.sfCrmAccount);
  t.truthy(prisma.sfCrmContact);
  t.truthy(prisma.sfCrmDealStage);
  t.truthy(prisma.sfCrmDeal);
  t.truthy(prisma.sfCrmActivity);
  t.truthy(prisma.sfReminder);
  t.truthy(prisma.sfReminderRule);
  t.truthy(prisma.sfReminderRun);
  t.truthy(prisma.sfNotificationDelivery);
});
