import type {
  MnReminderDto,
  MnReminderRuleDto,
} from '../../../../modules/manut-reminders';
import { toCsv } from '../../../../modules/manut-shared/csv';

export { downloadCsv, toCsv } from '../../../../modules/manut-shared/csv';

export function buildReminderCsv(reminders: readonly MnReminderDto[]) {
  return toCsv(
    [
      { header: 'Title', value: reminder => reminder.title },
      { header: 'Status', value: reminder => reminder.status },
      { header: 'Fire At', value: reminder => reminder.fireAt },
      { header: 'Channel', value: reminder => reminder.channel },
      { header: 'Body', value: reminder => reminder.body },
      {
        header: 'Related Entity Type',
        value: reminder => reminder.relatedEntityType,
      },
      {
        header: 'Related Entity ID',
        value: reminder => reminder.relatedEntityId,
      },
      { header: 'Rule ID', value: reminder => reminder.ruleId },
      { header: 'Completed At', value: reminder => reminder.completedAt },
      { header: 'Created At', value: reminder => reminder.createdAt },
      { header: 'Updated At', value: reminder => reminder.updatedAt },
    ],
    reminders
  );
}

export function buildReminderRulesCsv(rules: readonly MnReminderRuleDto[]) {
  return toCsv(
    [
      { header: 'Name', value: rule => rule.name },
      { header: 'Enabled', value: rule => rule.enabled },
      { header: 'Trigger', value: rule => rule.trigger },
      { header: 'Cron Expression', value: rule => rule.cronExpression },
      { header: 'Timezone', value: rule => rule.timezone },
      { header: 'Channel', value: rule => rule.config.channel ?? 'EMAIL' },
      { header: 'Body', value: rule => rule.config.body ?? null },
      { header: 'Last Evaluated At', value: rule => rule.lastEvaluatedAt },
      { header: 'Next Run At', value: rule => rule.nextRunAt },
      { header: 'Created At', value: rule => rule.createdAt },
      { header: 'Updated At', value: rule => rule.updatedAt },
    ],
    rules
  );
}

export function reminderExportFilename(
  entity: 'reminders' | 'rules',
  now = new Date()
) {
  return `manut-reminders-${entity}-${now.toISOString().slice(0, 10)}.csv`;
}
