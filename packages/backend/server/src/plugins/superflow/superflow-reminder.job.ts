import { Injectable, Logger } from '@nestjs/common';
import {
  MnNotificationChannel,
  MnNotificationDeliveryStatus,
  MnReminderStatus,
  PrismaClient,
} from '@prisma/client';

import { OnJob } from '../../base/job';
import { Mailer } from '../../core/mail/mailer';

declare global {
  interface Jobs {
    'superflow.deliverReminder': {
      reminderId: string;
      deliveryId: string;
    };
  }
}

@Injectable()
export class SuperflowReminderJob {
  private readonly logger = new Logger(SuperflowReminderJob.name);

  constructor(
    private readonly db: PrismaClient,
    private readonly mailer: Mailer
  ) {}

  @OnJob('superflow.deliverReminder')
  async deliverReminder(job: Jobs['superflow.deliverReminder']) {
    const delivery = await this.db.mnNotificationDelivery.findFirst({
      where: {
        id: job.deliveryId,
        reminderId: job.reminderId,
        status: MnNotificationDeliveryStatus.PENDING,
      },
      include: { reminder: { include: { user: true } } },
    });

    if (!delivery) {
      this.logger.warn(
        `Pending reminder delivery ${job.deliveryId} for reminder ${job.reminderId} was not found`
      );
      return;
    }
    if (!delivery.reminder) {
      await this.db.mnNotificationDelivery.update({
        where: { id: job.deliveryId },
        data: {
          status: MnNotificationDeliveryStatus.FAILED,
          error: 'Reminder was not found',
          lastAttemptAt: new Date(),
        },
      });
      return;
    }
    const { reminder } = delivery;

    if (reminder.status === MnReminderStatus.CANCELLED) {
      await this.db.mnNotificationDelivery.update({
        where: { id: job.deliveryId },
        data: {
          status: MnNotificationDeliveryStatus.SKIPPED,
          error: 'Reminder was cancelled before delivery',
          lastAttemptAt: new Date(),
        },
      });
      return;
    }

    if (reminder.channel !== MnNotificationChannel.EMAIL) {
      await this.failDelivery(
        job.deliveryId,
        job.reminderId,
        `Unsupported reminder channel: ${reminder.channel}`
      );
      return;
    }

    await this.db.mnReminder.update({
      where: { id: job.reminderId },
      data: { status: MnReminderStatus.PROCESSING },
    });
    await this.db.mnNotificationDelivery.update({
      where: { id: job.deliveryId },
      data: {
        attempts: { increment: 1 },
        error: null,
        lastAttemptAt: new Date(),
      },
    });

    const queued = await this.mailer.trySend({
      name: 'SuperflowReminder',
      to: reminder.user.email,
      props: {
        title: reminder.title,
        body: reminder.body ?? undefined,
        workspace: {
          $$workspaceId: reminder.workspaceId,
        },
      },
    });

    if (!queued) {
      await this.failDelivery(
        job.deliveryId,
        job.reminderId,
        'Failed to queue reminder email'
      );
      return;
    }

    await this.db.mnNotificationDelivery.update({
      where: { id: job.deliveryId },
      data: {
        status: MnNotificationDeliveryStatus.QUEUED,
        error: null,
        lastAttemptAt: new Date(),
      },
    });
  }

  private async failDelivery(
    deliveryId: string,
    reminderId: string,
    error: string
  ) {
    await this.db.mnNotificationDelivery.update({
      where: { id: deliveryId },
      data: {
        status: MnNotificationDeliveryStatus.FAILED,
        error,
        lastAttemptAt: new Date(),
      },
    });
    await this.db.mnReminder.update({
      where: { id: reminderId },
      data: { status: MnReminderStatus.FAILED },
    });
  }
}
