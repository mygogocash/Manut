import { Button, Switch } from '@affine/component';
import type { MnReminderRuleDto } from '@affine/core/modules/manut-reminders';
import { useI18n } from '@affine/i18n';
import { useCallback } from 'react';

import { summarizeCron } from './rule-modal';
import * as styles from './styles.css';

interface RuleRowProps {
  rule: MnReminderRuleDto;
  toggling: boolean;
  deleting: boolean;
  onToggle: (rule: MnReminderRuleDto, next: boolean) => void;
  onEdit: (rule: MnReminderRuleDto) => void;
  onDelete: (rule: MnReminderRuleDto) => void;
}

function formatRelative(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString();
}

const RuleRow = ({
  rule,
  toggling,
  deleting,
  onToggle,
  onEdit,
  onDelete,
}: RuleRowProps) => {
  const t = useI18n();
  const weekdayName = useCallback(
    (weekday: number) => {
      const keys = [
        'com.manut.reminders.rules.weekday.sunday',
        'com.manut.reminders.rules.weekday.monday',
        'com.manut.reminders.rules.weekday.tuesday',
        'com.manut.reminders.rules.weekday.wednesday',
        'com.manut.reminders.rules.weekday.thursday',
        'com.manut.reminders.rules.weekday.friday',
        'com.manut.reminders.rules.weekday.saturday',
      ] as const;
      const safe = Math.max(0, Math.min(6, weekday));
      return t[keys[safe]]();
    },
    [t]
  );

  const schedule = summarizeCron(rule.cronExpression, weekdayName);
  const lastRun = formatRelative(rule.lastEvaluatedAt);
  const nextRun = formatRelative(rule.nextRunAt);

  return (
    <article
      className={styles.card}
      data-testid="reminder-rule-card"
      data-rule-id={rule.id}
    >
      <header className={styles.cardHeader}>
        <div className={styles.cardTitle}>{rule.name}</div>
        <div className={styles.cardActions}>
          <Switch
            checked={rule.enabled}
            disabled={toggling}
            onChange={(next: boolean) => onToggle(rule, next)}
          />
        </div>
      </header>
      <div className={styles.cardBody}>
        {schedule || t['com.manut.reminders.rules.list.noSchedule']()}
      </div>
      <div className={styles.cardMeta}>
        <span>
          {t['com.manut.reminders.rules.list.lastRun']()}{' '}
          {lastRun ?? t['com.manut.reminders.rules.list.never']()}
        </span>
        <span>·</span>
        <span>
          {t['com.manut.reminders.rules.list.nextRun']()}{' '}
          {nextRun ?? t['com.manut.reminders.rules.list.unknown']()}
        </span>
      </div>
      <div className={styles.cardActions}>
        <Button
          variant="secondary"
          size="default"
          disabled={toggling || deleting}
          onClick={() => onEdit(rule)}
          data-testid="reminder-rule-edit"
        >
          {t['com.manut.reminders.rules.action.edit']()}
        </Button>
        <Button
          variant="secondary"
          size="default"
          disabled={toggling || deleting}
          loading={deleting}
          onClick={() => onDelete(rule)}
          data-testid="reminder-rule-delete"
        >
          {t['com.manut.reminders.rules.action.delete']()}
        </Button>
      </div>
    </article>
  );
};

export interface RuleListProps {
  rules: ReadonlyArray<MnReminderRuleDto>;
  togglingId: string | null;
  deletingId: string | null;
  onToggle: (rule: MnReminderRuleDto, next: boolean) => void;
  onEdit: (rule: MnReminderRuleDto) => void;
  onDelete: (rule: MnReminderRuleDto) => void;
}

export const RuleList = ({
  rules,
  togglingId,
  deletingId,
  onToggle,
  onEdit,
  onDelete,
}: RuleListProps) => {
  const t = useI18n();
  if (rules.length === 0) {
    return (
      <div className={styles.emptyState} data-testid="reminder-rules-empty">
        {t['com.manut.reminders.rules.list.empty']()}
      </div>
    );
  }
  return (
    <div className={styles.list} data-testid="reminder-rules-list">
      {rules.map(rule => (
        <RuleRow
          key={rule.id}
          rule={rule}
          toggling={togglingId === rule.id}
          deleting={deletingId === rule.id}
          onToggle={onToggle}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
};
