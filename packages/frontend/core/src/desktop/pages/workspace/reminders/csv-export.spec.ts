import { describe, expect, test } from 'vitest';

import type {
  MnReminderDto,
  MnReminderRuleDto,
} from '../../../../modules/manut-reminders';
import { buildReminderCsv, buildReminderRulesCsv } from './csv-export';

const reminder: MnReminderDto = {
  id: 'reminder-1',
  workspaceId: 'workspace-1',
  userId: 'user-1',
  title: '=Call customer',
  body: 'Discuss renewal',
  fireAt: '2026-06-01T09:00:00.000Z',
  channel: 'EMAIL',
  status: 'SCHEDULED',
  relatedEntityType: 'deal',
  relatedEntityId: 'deal-1',
  ruleId: 'rule-1',
  completedAt: null,
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
};

const rule: MnReminderRuleDto = {
  id: 'rule-1',
  workspaceId: 'workspace-1',
  name: 'Weekly, check-in',
  enabled: true,
  trigger: 'DATETIME',
  cronExpression: '0 9 * * 1',
  timezone: 'UTC',
  config: { channel: 'EMAIL', body: 'Plan "week"' },
  lastEvaluatedAt: '2026-06-01T09:00:00.000Z',
  nextRunAt: null,
  createdByUserId: 'user-1',
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
};

describe('Reminder CSV export helpers', () => {
  test('buildReminderCsv exports reminder rows with formula guard', () => {
    expect(buildReminderCsv([reminder])).toBe(
      [
        'Title,Status,Fire At,Channel,Body,Related Entity Type,Related Entity ID,Rule ID,Completed At,Created At,Updated At',
        "'=Call customer,SCHEDULED,2026-06-01T09:00:00.000Z,EMAIL,Discuss renewal,deal,deal-1,rule-1,,2026-06-01T00:00:00.000Z,2026-06-01T00:00:00.000Z",
        '',
      ].join('\r\n')
    );
  });

  test('buildReminderRulesCsv exports schedule and config fields', () => {
    expect(buildReminderRulesCsv([rule])).toBe(
      [
        'Name,Enabled,Trigger,Cron Expression,Timezone,Channel,Body,Last Evaluated At,Next Run At,Created At,Updated At',
        '"Weekly, check-in",true,DATETIME,0 9 * * 1,UTC,EMAIL,"Plan ""week""",2026-06-01T09:00:00.000Z,,2026-06-01T00:00:00.000Z,2026-06-01T00:00:00.000Z',
        '',
      ].join('\r\n')
    );
  });
});
