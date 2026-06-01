/**
 * Local Manut Reminders DTOs.
 *
 * Mirrors `MnReminderObjectType` and `MnReminderRule*` shapes from the
 * backend (`packages/backend/server/src/plugins/manut/manut-reminder.dto.ts`
 * + `manut-reminder.resolver.ts`) so the Reminders page can ship before
 * `@affine/graphql` regenerates an upstream-aware codegen result.
 */

export type MnReminderStatus =
  | 'SCHEDULED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'FAILED';

export type MnNotificationChannel = 'EMAIL';

export interface MnReminderDto {
  id: string;
  workspaceId: string;
  userId: string;
  title: string;
  body: string | null;
  fireAt: string;
  channel: MnNotificationChannel;
  status: MnReminderStatus;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  ruleId: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMnReminderInput {
  title: string;
  body?: string | null;
  fireAt: string;
  channel?: MnNotificationChannel;
}

/**
 * Rule trigger mirrors the Prisma `MnReminderRuleTrigger` enum. For v0 we
 * only expose the `DATETIME` (cron-driven) trigger in the UI — the other
 * triggers are reserved for entity-driven rules.
 */
export type MnReminderRuleTrigger =
  | 'DATETIME'
  | 'OVERDUE_TASK'
  | 'INACTIVITY'
  | 'UPCOMING_DEADLINE';

/**
 * Persisted configuration for a rule. Stored as JSONB on the backend; the
 * shape below covers what the v0 editor reads/writes. Anything not present
 * is treated as the default.
 */
export interface MnReminderRuleConfig {
  /** Reminder body template the rule should fire with. */
  body?: string | null;
  /** Channel for the generated reminders. Defaults to EMAIL. */
  channel?: MnNotificationChannel;
}

export interface MnReminderRuleDto {
  id: string;
  workspaceId: string;
  name: string;
  enabled: boolean;
  trigger: MnReminderRuleTrigger;
  cronExpression: string | null;
  timezone: string | null;
  config: MnReminderRuleConfig;
  lastEvaluatedAt: string | null;
  nextRunAt: string | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMnReminderRuleInput {
  name: string;
  enabled?: boolean;
  trigger: MnReminderRuleTrigger;
  cronExpression?: string | null;
  timezone?: string | null;
  config?: MnReminderRuleConfig;
}

export interface UpdateMnReminderRuleInput {
  name?: string;
  enabled?: boolean;
  cronExpression?: string | null;
  timezone?: string | null;
  config?: MnReminderRuleConfig;
}
