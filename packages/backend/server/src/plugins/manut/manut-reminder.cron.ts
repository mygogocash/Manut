import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  MnNotificationDeliveryStatus,
  MnReminderStatus,
  PrismaClient,
} from '@prisma/client';

import { JobQueue } from '../../base';

const REMINDER_SCAN_BATCH_SIZE = 100;

@Injectable()
export class MnReminderCron {
  private readonly logger = new Logger(MnReminderCron.name);

  constructor(
    private readonly db: PrismaClient,
    private readonly queue: JobQueue
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async enqueueDueReminders() {
    // BC: ENABLE_MANUT_MODULE is the new flag; ENABLE_SUPERFLOW_MODULE
    // is honored for environments that haven't been updated yet.
    const enabled =
      process.env.ENABLE_MANUT_MODULE ?? process.env.ENABLE_SUPERFLOW_MODULE;
    if (enabled !== 'true') {
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
      // Per-reminder isolation: a single failure (claim race, queue.add
      // rejection, transient DB error) must NOT abort the batch and block
      // every later due reminder (head-of-line blocking). Catch, mark the
      // offending reminder FAILED, log with context, and keep going.
      try {
        await this.enqueueReminder(reminder.id);
      } catch (error) {
        this.logger.error(
          `Failed to enqueue Manut reminder ${reminder.id}`,
          error instanceof Error ? error.stack : String(error)
        );
        await this.markReminderFailed(reminder.id);
      }
    }
  }

  private async enqueueReminder(reminderId: string) {
    const reminder = await this.db.mnReminder.findUnique({
      where: { id: reminderId },
    });
    if (!reminder) {
      return;
    }

    const claimed = await this.db.mnReminder.updateMany({
      where: { id: reminder.id, status: MnReminderStatus.SCHEDULED },
      data: { status: MnReminderStatus.PROCESSING },
    });
    if (claimed.count !== 1) {
      return;
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
      return;
    }
    if (existingDelivery?.status === MnNotificationDeliveryStatus.QUEUED) {
      return;
    }

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
      { jobId: `manut-deliver-reminder-${delivery.id}` }
    );
  }

  private async markReminderFailed(reminderId: string) {
    // Best-effort: never let the failure-marking itself throw out of the
    // loop. If even this DB write fails, the next cron tick re-scans.
    try {
      await this.db.mnReminder.update({
        where: { id: reminderId },
        data: { status: MnReminderStatus.FAILED },
      });
    } catch (error) {
      this.logger.error(
        `Failed to mark Manut reminder ${reminderId} as FAILED`,
        error instanceof Error ? error.stack : String(error)
      );
    }
  }
}
