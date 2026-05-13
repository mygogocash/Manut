import {
  MnNotificationChannel,
  MnNotificationDeliveryStatus,
  MnReminderStatus,
} from '@prisma/client';
import test from 'ava';

import { SuperflowReminderCron } from '../../plugins/superflow/superflow-reminder.cron';
import { SuperflowReminderJob } from '../../plugins/superflow/superflow-reminder.job';

test('Superflow reminder cron creates a delivery and enqueues due reminders', async t => {
  const fireAt = new Date('2026-05-09T00:00:00.000Z');
  const reminder = {
    id: 'reminder-1',
    workspaceId: 'workspace-1',
    channel: MnNotificationChannel.EMAIL,
    fireAt,
  };
  const createdDelivery = { id: 'delivery-1' };
  const queued: any[] = [];

  const db = {
    mnReminder: {
      findMany: async () => [reminder],
      updateMany: async (args: any) => {
        t.deepEqual(args, {
          where: { id: reminder.id, status: MnReminderStatus.SCHEDULED },
          data: { status: MnReminderStatus.PROCESSING },
        });
        return { count: 1 };
      },
      update: async () => t.fail('created reminders should not be completed'),
    },
    mnNotificationDelivery: {
      findFirst: async () => null,
      create: async (args: any) => {
        t.like(args, {
          data: {
            workspaceId: reminder.workspaceId,
            reminderId: reminder.id,
            channel: reminder.channel,
            status: MnNotificationDeliveryStatus.PENDING,
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
    channel: MnNotificationChannel.EMAIL,
    fireAt: new Date('2026-05-09T00:00:00.000Z'),
  };
  const queued: any[] = [];
  const reminderUpdates: any[] = [];
  let createCount = 0;

  const db = {
    mnReminder: {
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
    mnNotificationDelivery: {
      findFirst: async ({ where }: any) => {
        if (where.reminderId === 'reminder-1') {
          return {
            id: 'delivery-pending',
            status: MnNotificationDeliveryStatus.PENDING,
          };
        }

        if (where.reminderId === 'reminder-2') {
          return {
            id: 'delivery-sent',
            status: MnNotificationDeliveryStatus.SENT,
          };
        }

        return {
          id: 'delivery-queued',
          status: MnNotificationDeliveryStatus.QUEUED,
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
        status: MnReminderStatus.COMPLETED,
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
    mnReminder: {
      findMany: async () => [
        {
          id: 'reminder-1',
          workspaceId: 'workspace-1',
          channel: MnNotificationChannel.EMAIL,
          fireAt: new Date('2026-05-09T00:00:00.000Z'),
        },
      ],
      updateMany: async () => ({ count: 0 }),
      update: async () => t.fail('unclaimed reminders must not be updated'),
    },
    mnNotificationDelivery: {
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
    mnNotificationDelivery: {
      findFirst: async (args: any) => {
        t.like(args, {
          where: {
            id: deliveryId,
            reminderId,
            status: MnNotificationDeliveryStatus.PENDING,
          },
        });
        return {
          id: deliveryId,
          reminderId,
          status: MnNotificationDeliveryStatus.PENDING,
          reminder: {
            id: reminderId,
            workspaceId: 'workspace-1',
            title: 'Renew contract',
            body: 'Follow up with the customer today.',
            channel: MnNotificationChannel.EMAIL,
            status: MnReminderStatus.PROCESSING,
            user: { email: 'owner@example.com' },
          },
        };
      },
      update: async (args: any) => {
        deliveryUpdates.push(args);
      },
    },
    mnReminder: {
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
      update => update.data.status === MnReminderStatus.PROCESSING
    )
  );
  t.false(
    reminderUpdates.some(
      update => update.data.status === MnReminderStatus.COMPLETED
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
        update.data.status === MnNotificationDeliveryStatus.QUEUED &&
        update.data.lastAttemptAt instanceof Date
    )
  );
});

test('Superflow reminder job ignores stale or mismatched delivery jobs', async t => {
  let updateCount = 0;
  let sendCount = 0;
  const db = {
    mnNotificationDelivery: {
      findFirst: async () => null,
      update: async () => {
        updateCount += 1;
      },
    },
    mnReminder: {
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
    mnNotificationDelivery: {
      findFirst: async () => ({
        id: deliveryId,
        reminderId,
        status: MnNotificationDeliveryStatus.PENDING,
        reminder: {
          id: reminderId,
          workspaceId: 'workspace-1',
          title: 'Renew contract',
          body: null,
          channel: MnNotificationChannel.EMAIL,
          status: MnReminderStatus.PROCESSING,
          user: { email: 'owner@example.com' },
        },
      }),
      update: async (args: any) => {
        deliveryUpdates.push(args);
      },
    },
    mnReminder: {
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
        update.data.status === MnNotificationDeliveryStatus.FAILED &&
        update.data.error === 'Failed to queue reminder email'
    )
  );
  t.true(
    reminderUpdates.some(
      update => update.data.status === MnReminderStatus.FAILED
    )
  );
});
