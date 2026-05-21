import type { CreateMnReminderRuleInput, MnReminderRuleDto, UpdateMnReminderRuleInput } from '@affine/core/modules/manut-reminders';
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
/**
 * Convert a friendly preset to a 5-field cron expression
 * (`m h dom mon dow`). Pure function — exposed for unit tests.
 *
 * - `daily`   yields `m h * * *`
 * - `weekly`  yields `m h * * <weekday>`
 * - `monthly` yields `m h <monthDay> * *`
 */
export declare function presetToCron(preset: PresetState): string;
/**
 * Generate a human-readable summary for a cron expression. We only attempt
 * to parse the patterns our preset editor emits; anything else falls back
 * to the raw expression so the user still has *something* useful.
 *
 * Pure function — also useful in the list view.
 */
export declare function summarizeCron(cronExpression: string | null | undefined, weekdayName: (weekday: number) => string): string;
/**
 * Validate that a string is a 5-field cron expression with numeric or
 * `*` fields, optional ranges (`1-5`) and lists (`1,3,5`). This is a
 * conservative client-side check — the backend remains source of truth.
 */
export declare function isValidCronExpression(value: string): boolean;
export interface RuleModalProps {
    open: boolean;
    rule: MnReminderRuleDto | null;
    submitting: boolean;
    onSubmit: (input: CreateMnReminderRuleInput | UpdateMnReminderRuleInput) => Promise<void>;
    onClose: () => void;
}
export declare const RuleModal: ({ open, rule, submitting, onSubmit, onClose, }: RuleModalProps) => import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=rule-modal.d.ts.map