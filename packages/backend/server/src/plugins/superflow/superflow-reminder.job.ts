import { Injectable, Logger } from '@nestjs/common';
import {
  PrismaClient,
  SfNotificationChannel,
  SfNotificationDeliveryStatus,
  SfReminderStatus,
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
    const delivery = await this.db.sfNotificationDelivery.findFirst({
      where: {
        id: job.deliveryId,
        reminderId: job.reminderId,
        status: SfNotificationDeliveryStatus.PENDING,
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
      await this.db.sfNotificationDelivery.update({
        where: { id: job.deliveryId },
        data: {
          status: SfNotificationDeliveryStatus.FAILED,
          error: 'Reminder was not found',
          lastAttemptAt: new Date(),
        },
      });
      return;
    }
    const { reminder } = delivery;

    if (reminder.status === SfReminderStatus.CANCELLED) {
      await this.db.sfNotificationDelivery.update({
        where: { id: job.deliveryId },
        data: {
          status: SfNotificationDeliveryStatus.SKIPPED,
          error: 'Reminder was cancelled before delivery',
          lastAttemptAt: new Date(),
        },
      });
      return;
    }

    if (reminder.channel !== SfNotificationChannel.EMAIL) {
      await this.failDelivery(
        job.deliveryId,
        job.reminderId,
        `Unsupported reminder channel: ${reminder.channel}`
      );
      return;
    }

    await this.db.sfReminder.update({
      where: { id: job.reminderId },
      data: { status: SfReminderStatus.PROCESSING },
    });
    await this.db.sfNotificationDelivery.update({
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

    await this.db.sfNotificationDelivery.update({
      where: { id: job.deliveryId },
      data: {
        status: SfNotificationDeliveryStatus.QUEUED,
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
    await this.db.sfNotificationDelivery.update({
      where: { id: deliveryId },
      data: {
        status: SfNotificationDeliveryStatus.FAILED,
        error,
        lastAttemptAt: new Date(),
      },
    });
    await this.db.sfReminder.update({
      where: { id: reminderId },
      data: { status: SfReminderStatus.FAILED },
    });
  }
}
