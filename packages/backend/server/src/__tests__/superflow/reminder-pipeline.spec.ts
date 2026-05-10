import {
  SfNotificationChannel,
  SfNotificationDeliveryStatus,
  SfReminderStatus,
} from '@prisma/client';
import test from 'ava';

import { SuperflowReminderCron } from '../../plugins/superflow/superflow-reminder.cron';
import { SuperflowReminderJob } from '../../plugins/superflow/superflow-reminder.job';

test('Superflow reminder cron creates a delivery and enqueues due reminders', async t => {
  const fireAt = new Date('2026-05-09T00:00:00.000Z');
  const reminder = {
    id: 'reminder-1',
    workspaceId: 'workspace-1',
    channel: SfNotificationChannel.EMAIL,
    fireAt,
  };
  const createdDelivery = { id: 'delivery-1' };
  const queued: any[] = [];

  const db = {
    sfReminder: {
      findMany: async () => [reminder],
      updateMany: async (args: any) => {
        t.deepEqual(args, {
          where: { id: reminder.id, status: SfReminderStatus.SCHEDULED },
          data: { status: SfReminderStatus.PROCESSING },
        });
        return { count: 1 };
      },
      update: async () => t.fail('created reminders should not be completed'),
    },
    sfNotificationDelivery: {
      findFirst: async () => null,
      create: async (args: any) => {
        t.like(args, {
          data: {
            workspaceId: reminder.workspaceId,
            reminderId: reminder.id,
            channel: reminder.channel,
            status: SfNotificationDeliveryStatus.PENDING,
          },
        });
        t.deepEqual(args.data.payload, {
          reminderId: reminder.id,
          fireAt: fireAt.toISOString(),
        });
        return createdDelivery;
      },
    },
  };
  const queue = {
    add: async (...args: any[]) => {
      queued.push(args);
    },
  };

  const cron = new SuperflowReminderCron(db as any, queue as any);

  await cron.runOnce(new Date('2026-05-09T00:01:00.000Z'));

  t.deepEqual(queued, [
    [
      'superflow.deliverReminder',
      { reminderId: reminder.id, deliveryId: createdDelivery.id },
      { jobId: `superflow-deliver-reminder-${createdDelivery.id}` },
    ],
  ]);
});

test('Superflow reminder cron reuses pending delivery and skips terminal delivery states', async t => {
  const reminder = {
    id: 'reminder-1',
    workspaceId: 'workspace-1',
    channel: SfNotificationChannel.EMAIL,
    fireAt: new Date('2026-05-09T00:00:00.000Z'),
  };
  const queued: any[] = [];
  const reminderUpdates: any[] = [];
  let createCount = 0;

  const db = {
    sfReminder: {
      findMany: async () => [
        reminder,
        { ...reminder, id: 'reminder-2' },
        { ...reminder, id: 'reminder-3' },
      ],
      updateMany: async () => ({ count: 1 }),
      update: async (args: any) => {
        reminderUpdates.push(args);
      },
    },
    sfNotificationDelivery: {
      findFirst: async ({ where }: any) => {
        if (where.reminderId === 'reminder-1') {
          return {
            id: 'delivery-pending',
            status: SfNotificationDeliveryStatus.PENDING,
          };
        }

        if (where.reminderId === 'reminder-2') {
          return {
            id: 'delivery-sent',
            status: SfNotificationDeliveryStatus.SENT,
          };
        }

        return {
          id: 'delivery-queued',
          status: SfNotificationDeliveryStatus.QUEUED,
        };
      },
      create: async () => {
        createCount += 1;
      },
    },
  };
  const queue = {
    add: async (...args: any[]) => {
      queued.push(args);
    },
  };

  const cron = new SuperflowReminderCron(db as any, queue as any);

  await cron.runOnce();

  t.is(createCount, 0);
  t.deepEqual(queued, [
    [
      'superflow.deliverReminder',
      { reminderId: reminder.id, deliveryId: 'delivery-pending' },
      { jobId: 'superflow-deliver-reminder-delivery-pending' },
    ],
  ]);
  t.deepEqual(reminderUpdates, [
    {
      where: { id: 'reminder-2' },
      data: {
        status: SfReminderStatus.COMPLETED,
        completedAt: reminderUpdates[0].data.completedAt,
      },
    },
  ]);
  t.true(reminderUpdates[0].data.completedAt instanceof Date);
});

test('Superflow reminder cron skips reminders claimed by another worker', async t => {
  const queue = {
    add: async () => t.fail('unclaimed reminders must not be enqueued'),
  };
  const db = {
    sfReminder: {
      findMany: async () => [
        {
          id: 'reminder-1',
          workspaceId: 'workspace-1',
          channel: SfNotificationChannel.EMAIL,
          fireAt: new Date('2026-05-09T00:00:00.000Z'),
        },
      ],
      updateMany: async () => ({ count: 0 }),
      update: async () => t.fail('unclaimed reminders must not be updated'),
    },
    sfNotificationDelivery: {
      findFirst: async () =>
        t.fail('unclaimed reminders must not load deliveries'),
      create: async () =>
        t.fail('unclaimed reminders must not create delivery'),
    },
  };

  const cron = new SuperflowReminderCron(db as any, queue as any);

  await cron.runOnce();
  t.pass();
});

test('Superflow reminder job queues mail and marks delivery queued', async t => {
  const reminderId = 'reminder-1';
  const deliveryId = 'delivery-1';
  const reminderUpdates: any[] = [];
  const deliveryUpdates: any[] = [];
  const sentMail: any[] = [];

  const db = {
    sfNotificationDelivery: {
      findFirst: async (args: any) => {
        t.like(args, {
          where: {
            id: deliveryId,
            reminderId,
            status: SfNotificationDeliveryStatus.PENDING,
          },
        });
        return {
          id: deliveryId,
          reminderId,
          status: SfNotificationDeliveryStatus.PENDING,
          reminder: {
            id: reminderId,
            workspaceId: 'workspace-1',
            title: 'Renew contract',
            body: 'Follow up with the customer today.',
            channel: SfNotificationChannel.EMAIL,
            status: SfReminderStatus.PROCESSING,
            user: { email: 'owner@example.com' },
          },
        };
      },
      update: async (args: any) => {
        deliveryUpdates.push(args);
      },
    },
    sfReminder: {
      update: async (args: any) => {
        reminderUpdates.push(args);
      },
    },
  };
  const mailer = {
    trySend: async (command: any) => {
      sentMail.push(command);
      return true;
    },
  };

  const job = new SuperflowReminderJob(db as any, mailer as any);

  await job.deliverReminder({ reminderId, deliveryId });

  t.deepEqual(sentMail, [
    {
      name: 'SuperflowReminder',
      to: 'owner@example.com',
      props: {
        title: 'Renew contract',
        body: 'Follow up with the customer today.',
        workspace: {
          $$workspaceId: 'workspace-1',
        },
      },
    },
  ]);
  t.true(
    reminderUpdates.some(
      update => update.data.status === SfReminderStatus.PROCESSING
    )
  );
  t.false(
    reminderUpdates.some(
      update => update.data.status === SfReminderStatus.COMPLETED
    )
  );
  t.true(
    deliveryUpdates.some(
      update =>
        update.data.attempts?.increment === 1 &&
        update.data.error === null &&
        update.data.lastAttemptAt instanceof Date
    )
  );
  t.true(
    deliveryUpdates.some(
      update =>
        update.data.status === SfNotificationDeliveryStatus.QUEUED &&
        update.data.lastAttemptAt instanceof Date
    )
  );
});

test('Superflow reminder job ignores stale or mismatched delivery jobs', async t => {
  let updateCount = 0;
  let sendCount = 0;
  const db = {
    sfNotificationDelivery: {
      findFirst: async () => null,
      update: async () => {
        updateCount += 1;
      },
    },
    sfReminder: {
      update: async () => {
        updateCount += 1;
      },
    },
  };
  const mailer = {
    trySend: async () => {
      sendCount += 1;
      return true;
    },
  };

  const job = new SuperflowReminderJob(db as any, mailer as any);

  await job.deliverReminder({
    reminderId: 'reminder-1',
    deliveryId: 'wrong-delivery',
  });

  t.is(updateCount, 0);
  t.is(sendCount, 0);
});

test('Superflow reminder job marks delivery failed when mail cannot queue', async t => {
  const reminderId = 'reminder-1';
  const deliveryId = 'delivery-1';
  const reminderUpdates: any[] = [];
  const deliveryUpdates: any[] = [];

  const db = {
    sfNotificationDelivery: {
      findFirst: async () => ({
        id: deliveryId,
        reminderId,
        status: SfNotificationDeliveryStatus.PENDING,
        reminder: {
          id: reminderId,
          workspaceId: 'workspace-1',
          title: 'Renew contract',
          body: null,
          channel: SfNotificationChannel.EMAIL,
          status: SfReminderStatus.PROCESSING,
          user: { email: 'owner@example.com' },
        },
      }),
      update: async (args: any) => {
        deliveryUpdates.push(args);
      },
    },
    sfReminder: {
      update: async (args: any) => {
        reminderUpdates.push(args);
      },
    },
  };
  const mailer = {
    trySend: async () => false,
  };

  const job = new SuperflowReminderJob(db as any, mailer as any);

  await job.deliverReminder({ reminderId, deliveryId });

  t.true(
    deliveryUpdates.some(
      update =>
        update.data.status === SfNotificationDeliveryStatus.FAILED &&
        update.data.error === 'Failed to queue reminder email'
    )
  );
  t.true(
    reminderUpdates.some(
      update => update.data.status === SfReminderStatus.FAILED
    )
  );
});
