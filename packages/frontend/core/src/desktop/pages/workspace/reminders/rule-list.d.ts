import type { MnReminderRuleDto } from '@affine/core/modules/manut-reminders';
export interface RuleListProps {
    rules: ReadonlyArray<MnReminderRuleDto>;
    togglingId: string | null;
    deletingId: string | null;
    onToggle: (rule: MnReminderRuleDto, next: boolean) => void;
    onEdit: (rule: MnReminderRuleDto) => void;
    onDelete: (rule: MnReminderRuleDto) => void;
}
export declare const RuleList: ({ rules, togglingId, deletingId, onToggle, onEdit, onDelete, }: RuleListProps) => import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=rule-list.d.ts.map