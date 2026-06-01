import { Button, Input, Modal, Switch } from '@affine/component';
import type {
  CreateMnReminderRuleInput,
  MnNotificationChannel,
  MnReminderRuleDto,
  UpdateMnReminderRuleInput,
} from '@affine/core/modules/manut-reminders';
import { useI18n } from '@affine/i18n';
import { useCallback, useEffect, useMemo, useState } from 'react';

import * as styles from './styles.css';

export type RecurrenceMode = 'preset' | 'cron';

export type PresetFrequency = 'daily' | 'weekly' | 'monthly';

export interface PresetState {
  frequency: PresetFrequency;
  /** 0..23 — hour-of-day in the workspace timezone. */
  hour: number;
  /** 0..59 — minute-of-hour. */
  minute: number;
  /** 0..6 (Sun..Sat) for `weekly`. */
  weekday: number;
  /** 1..28 for `monthly`. We cap at 28 so every month is valid. */
  monthDay: number;
}

const DEFAULT_PRESET: PresetState = {
  frequency: 'weekly',
  hour: 9,
  minute: 0,
  weekday: 1,
  monthDay: 1,
};

const DEFAULT_CRON = '0 9 * * 1';

const CHANNELS: ReadonlyArray<{
  value: MnNotificationChannel;
  labelKey:
    | 'com.manut.reminders.rules.channel.email'
    | 'com.manut.reminders.rules.channel.inApp';
}> = [
  { value: 'EMAIL', labelKey: 'com.manut.reminders.rules.channel.email' },
  { value: 'IN_APP', labelKey: 'com.manut.reminders.rules.channel.inApp' },
];

/**
 * Convert a friendly preset to a 5-field cron expression
 * (`m h dom mon dow`). Pure function — exposed for unit tests.
 *
 * - `daily`   yields `m h * * *`
 * - `weekly`  yields `m h * * <weekday>`
 * - `monthly` yields `m h <monthDay> * *`
 */
export function presetToCron(preset: PresetState): string {
  const minute = clampInt(preset.minute, 0, 59);
  const hour = clampInt(preset.hour, 0, 23);
  switch (preset.frequency) {
    case 'daily':
      return `${minute} ${hour} * * *`;
    case 'weekly': {
      const weekday = clampInt(preset.weekday, 0, 6);
      return `${minute} ${hour} * * ${weekday}`;
    }
    case 'monthly': {
      const monthDay = clampInt(preset.monthDay, 1, 28);
      return `${minute} ${hour} ${monthDay} * *`;
    }
  }
}

/**
 * Generate a human-readable summary for a cron expression. We only attempt
 * to parse the patterns our preset editor emits; anything else falls back
 * to the raw expression so the user still has *something* useful.
 *
 * Pure function — also useful in the list view.
 */
export function summarizeCron(
  cronExpression: string | null | undefined,
  weekdayName: (weekday: number) => string
): string {
  if (!cronExpression) return '';
  const parts = cronExpression.trim().split(/\s+/);
  if (parts.length !== 5) return cronExpression;
  const [m, h, dom, mon, dow] = parts;
  const hh = Number.parseInt(h, 10);
  const mm = Number.parseInt(m, 10);
  if (
    Number.isNaN(hh) ||
    Number.isNaN(mm) ||
    hh < 0 ||
    hh > 23 ||
    mm < 0 ||
    mm > 59
  ) {
    return cronExpression;
  }
  const time = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  if (mon !== '*') return cronExpression;
  if (dom === '*' && dow === '*') return `Daily at ${time}`;
  if (dom === '*') {
    const day = Number.parseInt(dow, 10);
    if (!Number.isNaN(day) && day >= 0 && day <= 6) {
      return `Every ${weekdayName(day)} at ${time}`;
    }
    return cronExpression;
  }
  if (dow === '*') {
    const day = Number.parseInt(dom, 10);
    if (!Number.isNaN(day) && day >= 1 && day <= 31) {
      return `Day ${day} of each month at ${time}`;
    }
    return cronExpression;
  }
  return cronExpression;
}

/**
 * Validate that a string is a 5-field cron expression with numeric or
 * `*` fields, optional ranges (`1-5`) and lists (`1,3,5`). This is a
 * conservative client-side check — the backend remains source of truth.
 */
export function isValidCronExpression(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  const parts = trimmed.split(/\s+/);
  if (parts.length !== 5) return false;
  const fieldPattern = /^(\*|(\d+(-\d+)?)(,\d+(-\d+)?)*)$/;
  return parts.every(p => fieldPattern.test(p));
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  const rounded = Math.round(value);
  if (rounded < min) return min;
  if (rounded > max) return max;
  return rounded;
}

export interface RuleModalProps {
  open: boolean;
  rule: MnReminderRuleDto | null;
  submitting: boolean;
  onSubmit: (
    input: CreateMnReminderRuleInput | UpdateMnReminderRuleInput
  ) => Promise<void>;
  onClose: () => void;
}

interface ParsedRule {
  mode: RecurrenceMode;
  preset: PresetState;
  cron: string;
}

function parseRule(rule: MnReminderRuleDto | null): ParsedRule {
  if (!rule || !rule.cronExpression) {
    return { mode: 'preset', preset: DEFAULT_PRESET, cron: DEFAULT_CRON };
  }
  const parts = rule.cronExpression.trim().split(/\s+/);
  if (parts.length === 5 && parts[3] === '*') {
    const [m, h, dom, , dow] = parts;
    const minute = Number.parseInt(m, 10);
    const hour = Number.parseInt(h, 10);
    if (Number.isFinite(minute) && Number.isFinite(hour)) {
      if (dom === '*' && dow === '*') {
        return {
          mode: 'preset',
          preset: { ...DEFAULT_PRESET, frequency: 'daily', minute, hour },
          cron: rule.cronExpression,
        };
      }
      if (dom === '*') {
        const weekday = Number.parseInt(dow, 10);
        if (Number.isFinite(weekday) && weekday >= 0 && weekday <= 6) {
          return {
            mode: 'preset',
            preset: {
              ...DEFAULT_PRESET,
              frequency: 'weekly',
              minute,
              hour,
              weekday,
            },
            cron: rule.cronExpression,
          };
        }
      }
      if (dow === '*') {
        const monthDay = Number.parseInt(dom, 10);
        if (Number.isFinite(monthDay) && monthDay >= 1 && monthDay <= 28) {
          return {
            mode: 'preset',
            preset: {
              ...DEFAULT_PRESET,
              frequency: 'monthly',
              minute,
              hour,
              monthDay,
            },
            cron: rule.cronExpression,
          };
        }
      }
    }
  }
  // Fallback: keep the raw cron expression and show the advanced input.
  return {
    mode: 'cron',
    preset: DEFAULT_PRESET,
    cron: rule.cronExpression,
  };
}

function timeToValue(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function parseTimeValue(
  value: string
): { hour: number; minute: number } | null {
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number.parseInt(match[1], 10);
  const minute = Number.parseInt(match[2], 10);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

export const RuleModal = ({
  open,
  rule,
  submitting,
  onSubmit,
  onClose,
}: RuleModalProps) => {
  const t = useI18n();

  const initial = useMemo(() => parseRule(rule), [rule]);

  const [name, setName] = useState<string>(rule?.name ?? '');
  const [enabled, setEnabled] = useState<boolean>(rule?.enabled ?? true);
  const [body, setBody] = useState<string>(rule?.config?.body ?? '');
  const [channel, setChannel] = useState<MnNotificationChannel>(
    rule?.config?.channel ?? 'EMAIL'
  );
  const [mode, setMode] = useState<RecurrenceMode>(initial.mode);
  const [preset, setPreset] = useState<PresetState>(initial.preset);
  const [cron, setCron] = useState<string>(initial.cron);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Reset form whenever the modal opens with a (possibly new) rule.
  useEffect(() => {
    if (!open) return;
    const next = parseRule(rule);
    setName(rule?.name ?? '');
    setEnabled(rule?.enabled ?? true);
    setBody(rule?.config?.body ?? '');
    setChannel(rule?.config?.channel ?? 'EMAIL');
    setMode(next.mode);
    setPreset(next.preset);
    setCron(next.cron);
    setSubmitError(null);
  }, [open, rule]);

  const effectiveCron = mode === 'preset' ? presetToCron(preset) : cron.trim();
  const cronValid = isValidCronExpression(effectiveCron);
  const trimmedName = name.trim();
  const canSubmit = trimmedName.length > 0 && cronValid && !submitting;

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next && !submitting) {
        onClose();
      }
    },
    [onClose, submitting]
  );

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitError(null);
    try {
      const config = {
        body: body.trim() ? body.trim() : null,
        channel,
      };
      if (rule) {
        const patch: UpdateMnReminderRuleInput = {
          name: trimmedName,
          enabled,
          cronExpression: effectiveCron,
          config,
        };
        await onSubmit(patch);
      } else {
        const input: CreateMnReminderRuleInput = {
          name: trimmedName,
          enabled,
          trigger: 'DATETIME',
          cronExpression: effectiveCron,
          config,
        };
        await onSubmit(input);
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : t['com.manut.reminders.rules.error.submit']();
      setSubmitError(message);
    }
  }, [
    body,
    canSubmit,
    channel,
    effectiveCron,
    enabled,
    onSubmit,
    rule,
    t,
    trimmedName,
  ]);

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
      const key = keys[safe];
      return t[key]();
    },
    [t]
  );

  const summary = summarizeCron(effectiveCron, weekdayName);

  return (
    <Modal
      open={open}
      onOpenChange={handleOpenChange}
      title={
        rule
          ? t['com.manut.reminders.rules.modal.edit.title']()
          : t['com.manut.reminders.rules.modal.create.title']()
      }
      description={t['com.manut.reminders.rules.modal.description']()}
      width={560}
      persistent={submitting}
    >
      <div className={styles.modalBody} data-testid="reminder-rule-modal">
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel} htmlFor="sf-rule-name">
            {t['com.manut.reminders.rules.field.name.label']()}
          </label>
          <Input
            id="sf-rule-name"
            value={name}
            placeholder={t[
              'com.manut.reminders.rules.field.name.placeholder'
            ]()}
            onChange={(value: string) => setName(value)}
            disabled={submitting}
            autoFocus
          />
        </div>

        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>
            {t['com.manut.reminders.rules.field.recurrence.label']()}
          </span>
          <div className={styles.modeToggle}>
            <button
              type="button"
              className={styles.modeButton}
              data-active={mode === 'preset'}
              onClick={() => setMode('preset')}
              disabled={submitting}
              data-testid="rule-mode-preset"
            >
              {t['com.manut.reminders.rules.field.recurrence.preset']()}
            </button>
            <button
              type="button"
              className={styles.modeButton}
              data-active={mode === 'cron'}
              onClick={() => setMode('cron')}
              disabled={submitting}
              data-testid="rule-mode-cron"
            >
              {t['com.manut.reminders.rules.field.recurrence.advanced']()}
            </button>
          </div>
        </div>

        {mode === 'preset' ? (
          <div className={styles.presetGrid} data-testid="rule-preset-grid">
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel} htmlFor="sf-rule-frequency">
                {t['com.manut.reminders.rules.field.frequency.label']()}
              </label>
              <select
                id="sf-rule-frequency"
                className={styles.select}
                value={preset.frequency}
                onChange={event =>
                  setPreset(prev => ({
                    ...prev,
                    frequency: event.target.value as PresetFrequency,
                  }))
                }
                disabled={submitting}
              >
                <option value="daily">
                  {t['com.manut.reminders.rules.frequency.daily']()}
                </option>
                <option value="weekly">
                  {t['com.manut.reminders.rules.frequency.weekly']()}
                </option>
                <option value="monthly">
                  {t['com.manut.reminders.rules.frequency.monthly']()}
                </option>
              </select>
            </div>

            {preset.frequency === 'weekly' ? (
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor="sf-rule-weekday">
                  {t['com.manut.reminders.rules.field.weekday.label']()}
                </label>
                <select
                  id="sf-rule-weekday"
                  className={styles.select}
                  value={preset.weekday}
                  onChange={event =>
                    setPreset(prev => ({
                      ...prev,
                      weekday: Number.parseInt(event.target.value, 10),
                    }))
                  }
                  disabled={submitting}
                >
                  {[0, 1, 2, 3, 4, 5, 6].map(weekday => (
                    <option key={weekday} value={weekday}>
                      {weekdayName(weekday)}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {preset.frequency === 'monthly' ? (
              <div className={styles.fieldGroup}>
                <label
                  className={styles.fieldLabel}
                  htmlFor="sf-rule-month-day"
                >
                  {t['com.manut.reminders.rules.field.monthDay.label']()}
                </label>
                <select
                  id="sf-rule-month-day"
                  className={styles.select}
                  value={preset.monthDay}
                  onChange={event =>
                    setPreset(prev => ({
                      ...prev,
                      monthDay: Number.parseInt(event.target.value, 10),
                    }))
                  }
                  disabled={submitting}
                >
                  {Array.from({ length: 28 }, (_, i) => i + 1).map(day => (
                    <option key={day} value={day}>
                      {day}
                    </option>
                  ))}
                </select>
                <div className={styles.fieldHint}>
                  {t['com.manut.reminders.rules.field.monthDay.hint']()}
                </div>
              </div>
            ) : null}

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel} htmlFor="sf-rule-time">
                {t['com.manut.reminders.rules.field.time.label']()}
              </label>
              <input
                id="sf-rule-time"
                type="time"
                className={styles.datetimeInput}
                value={timeToValue(preset.hour, preset.minute)}
                onChange={event => {
                  const parsed = parseTimeValue(event.target.value);
                  if (parsed) {
                    setPreset(prev => ({
                      ...prev,
                      hour: parsed.hour,
                      minute: parsed.minute,
                    }));
                  }
                }}
                disabled={submitting}
              />
            </div>
          </div>
        ) : (
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel} htmlFor="sf-rule-cron">
              {t['com.manut.reminders.rules.field.cron.label']()}
            </label>
            <Input
              id="sf-rule-cron"
              value={cron}
              placeholder="0 9 * * 1"
              onChange={(value: string) => setCron(value)}
              disabled={submitting}
            />
            <div className={styles.fieldHint}>
              {t['com.manut.reminders.rules.field.cron.hint']()}
            </div>
          </div>
        )}

        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>
            {t['com.manut.reminders.rules.field.summary.label']()}
          </span>
          <div className={styles.summary} data-testid="rule-summary">
            {cronValid
              ? summary
              : t['com.manut.reminders.rules.field.summary.invalid']()}
          </div>
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel} htmlFor="sf-rule-body">
            {t['com.manut.reminders.rules.field.body.label']()}
          </label>
          <textarea
            id="sf-rule-body"
            className={styles.textarea}
            value={body}
            placeholder={t[
              'com.manut.reminders.rules.field.body.placeholder'
            ]()}
            onChange={event => setBody(event.target.value)}
            disabled={submitting}
          />
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel} htmlFor="sf-rule-channel">
            {t['com.manut.reminders.rules.field.channel.label']()}
          </label>
          <select
            id="sf-rule-channel"
            className={styles.select}
            value={channel}
            onChange={event =>
              setChannel(event.target.value as MnNotificationChannel)
            }
            disabled={submitting}
          >
            {CHANNELS.map(option => (
              <option key={option.value} value={option.value}>
                {t[option.labelKey]()}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.enabledRow}>
          <span className={styles.fieldLabel}>
            {t['com.manut.reminders.rules.field.enabled.label']()}
          </span>
          <Switch
            checked={enabled}
            onChange={(next: boolean) => setEnabled(next)}
            disabled={submitting}
          />
        </div>

        {submitError ? (
          <div className={styles.errorState} role="alert">
            {submitError}
          </div>
        ) : null}
      </div>

      <div className={styles.modalActions}>
        <Button
          variant="secondary"
          disabled={submitting}
          onClick={() => handleOpenChange(false)}
        >
          {t['com.manut.reminders.rules.modal.cancel']()}
        </Button>
        <Button
          variant="primary"
          disabled={!canSubmit}
          loading={submitting}
          onClick={() => void handleSubmit()}
          data-testid="rule-submit"
        >
          {rule
            ? t['com.manut.reminders.rules.modal.save']()
            : t['com.manut.reminders.rules.modal.create']()}
        </Button>
      </div>
    </Modal>
  );
};
