import { type MnReminderDto } from '@affine/core/modules/manut-reminders';
type TabKey = 'due' | 'upcoming' | 'done' | 'rules';
declare function classifyReminder(reminder: MnReminderDto, now: number): TabKey;
export { classifyReminder };
export declare const Component: () => import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=index.d.ts.map