import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  PrismaClient,
  SfNotificationDeliveryStatus,
  SfReminderStatus,
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
    const reminders = await this.db.sfReminder.findMany({
      where: {
        status: SfReminderStatus.SCHEDULED,
        fireAt: { lte: now },
      },
      orderBy: { fireAt: 'asc' },
      take: REMINDER_SCAN_BATCH_SIZE,
    });

    for (const reminder of reminders) {
      const claimed = await this.db.sfReminder.updateMany({
        where: { id: reminder.id, status: SfReminderStatus.SCHEDULED },
        data: { status: SfReminderStatus.PROCESSING },
      });
      if (claimed.count !== 1) {
        continue;
      }

      const existingDelivery = await this.db.sfNotificationDelivery.findFirst({
        where: {
          reminderId: reminder.id,
          status: {
            in: [
              SfNotificationDeliveryStatus.PENDING,
              SfNotificationDeliveryStatus.QUEUED,
              SfNotificationDeliveryStatus.SENT,
            ],
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (existingDelivery?.status === SfNotificationDeliveryStatus.SENT) {
        await this.db.sfReminder.update({
          where: { id: reminder.id },
          data: { status: SfReminderStatus.COMPLETED, completedAt: new Date() },
        });
        continue;
      }
      if (existingDelivery?.status === SfNotificationDeliveryStatus.QUEUED) {
        continue;
      }

      try {
        const delivery =
          existingDelivery ??
          (await this.db.sfNotificationDelivery.create({
            data: {
              workspaceId: reminder.workspaceId,
              reminderId: reminder.id,
              channel: reminder.channel,
              status: SfNotificationDeliveryStatus.PENDING,
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
        await this.db.sfReminder.update({
          where: { id: reminder.id },
          data: {
            status: SfReminderStatus.FAILED,
          },
        });
        throw error;
      }
    }
  }
}
