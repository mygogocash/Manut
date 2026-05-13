import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  MnNotificationDeliveryStatus,
  MnReminderStatus,
  PrismaClient,
} from '@prisma/client';

import { JobQueue } from '../../base';

const REMINDER_SCAN_BATCH_SIZE = 100;

@Injectable()
export class SuperflowReminderCron {
  constructor(
    private readonly db: PrismaClient,
    private readonly queue: JobQueue
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async enqueueDueReminders() {
    if (process.env.ENABLE_SUPERFLOW_MODULE !== 'true') {
      return;
    }

    await this.runOnce();
  }

  async runOnce(now = new Date()) {
    const reminders = await this.db.mnReminder.findMany({
      where: {
        status: MnReminderStatus.SCHEDULED,
        fireAt: { lte: now },
      },
      orderBy: { fireAt: 'asc' },
      take: REMINDER_SCAN_BATCH_SIZE,
    });

    for (const reminder of reminders) {
      const claimed = await this.db.mnReminder.updateMany({
        where: { id: reminder.id, status: MnReminderStatus.SCHEDULED },
        data: { status: MnReminderStatus.PROCESSING },
      });
      if (claimed.count !== 1) {
        continue;
      }

      const existingDelivery = await this.db.mnNotificationDelivery.findFirst({
        where: {
          reminderId: reminder.id,
          status: {
            in: [
              MnNotificationDeliveryStatus.PENDING,
              MnNotificationDeliveryStatus.QUEUED,
              MnNotificationDeliveryStatus.SENT,
            ],
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (existingDelivery?.status === MnNotificationDeliveryStatus.SENT) {
        await this.db.mnReminder.update({
          where: { id: reminder.id },
          data: { status: MnReminderStatus.COMPLETED, completedAt: new Date() },
        });
        continue;
      }
      if (existingDelivery?.status === MnNotificationDeliveryStatus.QUEUED) {
        continue;
      }

      try {
        const delivery =
          existingDelivery ??
          (await this.db.mnNotificationDelivery.create({
            data: {
              workspaceId: reminder.workspaceId,
              reminderId: reminder.id,
              channel: reminder.channel,
              status: MnNotificationDeliveryStatus.PENDING,
              payload: {
                reminderId: reminder.id,
                fireAt: reminder.fireAt.toISOString(),
              },
            },
          }));

        await this.queue.add(
          'superflow.deliverReminder',
          { reminderId: reminder.id, deliveryId: delivery.id },
          { jobId: `superflow-deliver-reminder-${delivery.id}` }
        );
      } catch (error) {
        await this.db.mnReminder.update({
          where: { id: reminder.id },
          data: {
            status: MnReminderStatus.FAILED,
          },
        });
        throw error;
      }
    }
  }
}
