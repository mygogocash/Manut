import { randomUUID } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  MnNotificationChannel,
  MnNotificationDeliveryStatus,
  MnReminderRuleTrigger,
  MnReminderStatus,
  PrismaClient,
} from '@prisma/client';

import { JobQueue } from '../../base';

const REMINDER_SCAN_BATCH_SIZE = 100;
const REMINDER_RULE_SCAN_BATCH_SIZE = 100;

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
    await this.materializeDueReminderRules(now);

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

  private async materializeDueReminderRules(now: Date) {
    if (!this.db.mnReminderRule || !this.db.mnReminderRun) {
      return;
    }

    const scheduledFor = truncateToMinute(now);
    const rules = await this.db.mnReminderRule.findMany({
      where: {
        enabled: true,
        trigger: MnReminderRuleTrigger.DATETIME,
        cronExpression: { not: null },
      },
      orderBy: { createdAt: 'asc' },
      take: REMINDER_RULE_SCAN_BATCH_SIZE,
    });

    for (const rule of rules) {
      if (!cronMatchesDate(rule.cronExpression, scheduledFor)) {
        continue;
      }

      const dedupeKey = scheduledFor.toISOString();
      let runId: string | null = null;

      try {
        const run = await this.db.mnReminderRun.create({
          data: {
            id: randomUUID(),
            ruleId: rule.id,
            dedupeKey,
            scheduledFor,
            startedAt: now,
          },
        });
        runId = run.id;

        const config = normalizeRuleConfig(rule.config);
        await this.db.mnReminder.create({
          data: {
            id: randomUUID(),
            workspaceId: rule.workspaceId,
            userId: rule.createdByUserId,
            title: rule.name,
            body: config.body,
            fireAt: scheduledFor,
            channel: config.channel,
            status: MnReminderStatus.SCHEDULED,
            ruleId: rule.id,
          },
        });

        await this.db.mnReminderRun.update({
          where: { id: run.id },
          data: {
            success: true,
            finishedAt: now,
          },
        });
        await this.db.mnReminderRule.update({
          where: { id: rule.id },
          data: { lastEvaluatedAt: now },
        });
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          continue;
        }
        this.logger.error(
          `Failed to materialize Manut reminder rule ${rule.id}`,
          error instanceof Error ? error.stack : String(error)
        );
        if (runId) {
          await this.markRuleRunFailed(runId, error, now);
        }
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

  private async markRuleRunFailed(runId: string, error: unknown, now: Date) {
    try {
      await this.db.mnReminderRun.update({
        where: { id: runId },
        data: {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          finishedAt: now,
        },
      });
    } catch (markError) {
      this.logger.error(
        `Failed to mark Manut reminder run ${runId} as failed`,
        markError instanceof Error ? markError.stack : String(markError)
      );
    }
  }
}

function truncateToMinute(value: Date) {
  const next = new Date(value);
  next.setUTCSeconds(0, 0);
  return next;
}

function normalizeRuleConfig(config: unknown): {
  body: string | null;
  channel: MnNotificationChannel;
} {
  const object =
    config && typeof config === 'object' && !Array.isArray(config)
      ? (config as Record<string, unknown>)
      : {};
  const body = typeof object.body === 'string' ? object.body : null;
  const channel = MnNotificationChannel.EMAIL;
  return { body, channel };
}

function cronMatchesDate(expression: string | null, date: Date): boolean {
  if (!expression) {
    return false;
  }

  const parts = expression.trim().split(/\s+/);
  const fields = parts.length === 6 ? parts.slice(1) : parts;
  if (fields.length !== 5) {
    return false;
  }

  const [minute, hour, dayOfMonth, month, dayOfWeek] = fields;
  return (
    cronFieldMatches(minute, date.getUTCMinutes(), 0, 59) &&
    cronFieldMatches(hour, date.getUTCHours(), 0, 23) &&
    cronFieldMatches(dayOfMonth, date.getUTCDate(), 1, 31) &&
    cronFieldMatches(month, date.getUTCMonth() + 1, 1, 12) &&
    cronFieldMatches(dayOfWeek, date.getUTCDay(), 0, 7, true)
  );
}

function cronFieldMatches(
  field: string,
  value: number,
  min: number,
  max: number,
  sundaySeven = false
): boolean {
  if (field === '*' || field === '?') {
    return true;
  }

  return field.split(',').some(part => {
    if (part.includes('/')) {
      const [base, stepValue] = part.split('/');
      const step = Number(stepValue);
      if (!Number.isInteger(step) || step <= 0) {
        return false;
      }
      if (base === '*') {
        return (value - min) % step === 0;
      }
      return cronFieldMatches(base, value, min, max, sundaySeven);
    }

    if (part.includes('-')) {
      const [startValue, endValue] = part.split('-');
      const start = normalizeCronNumber(startValue, sundaySeven);
      const end = normalizeCronNumber(endValue, sundaySeven);
      if (!isCronNumberInRange(start, min, max)) return false;
      if (!isCronNumberInRange(end, min, max)) return false;
      return value >= start && value <= end;
    }

    const exact = normalizeCronNumber(part, sundaySeven);
    return isCronNumberInRange(exact, min, max) && value === exact;
  });
}

function normalizeCronNumber(value: string | undefined, sundaySeven: boolean) {
  const parsed = Number(value);
  if (sundaySeven && parsed === 7) {
    return 0;
  }
  return parsed;
}

function isCronNumberInRange(value: number, min: number, max: number) {
  return Number.isInteger(value) && value >= min && value <= max;
}

function isUniqueConstraintError(error: unknown) {
  return (
    !!error &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}
