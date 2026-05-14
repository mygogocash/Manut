import { PrismaClient } from '@prisma/client';
import test from 'ava';

/**
 * Smoke test: Manut tables are registered on the generated client.
 * Catches missing migrations / failed prisma generate in CI.
 */
test('Prisma client exposes Manut Mn* model delegates', t => {
  const prisma = new PrismaClient();
  t.truthy(prisma.mnProject);
  t.truthy(prisma.mnProjectMember);
  t.truthy(prisma.mnTask);
  t.truthy(prisma.mnTaskComment);
  t.truthy(prisma.mnTaskActivity);
  t.truthy(prisma.mnCrmAccount);
  t.truthy(prisma.mnCrmContact);
  t.truthy(prisma.mnCrmDealStage);
  t.truthy(prisma.mnCrmDeal);
  t.truthy(prisma.mnCrmActivity);
  t.truthy(prisma.mnReminder);
  t.truthy(prisma.mnReminderRule);
  t.truthy(prisma.mnReminderRun);
  t.truthy(prisma.mnNotificationDelivery);
  t.truthy(prisma.mnAgentRole);
});
