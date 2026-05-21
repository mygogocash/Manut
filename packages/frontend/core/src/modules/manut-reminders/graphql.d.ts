/**
 * Temporary local GraphQL operations for the Manut Reminders page.
 *
 * Mirrors the codegen operation-object shape (`{ id, op, query }`) so the
 * page can ship alongside the backend resolver before `@affine/graphql`
 * has been regenerated.
 *
 * Resolver: `packages/backend/server/src/plugins/manut/manut-reminder.resolver.ts`.
 */
export declare const mnRemindersQuery: {
    id: "mnRemindersQuery";
    op: string;
    query: string;
};
export declare const createMnReminderMutation: {
    id: "createMnReminderMutation";
    op: string;
    query: string;
};
export declare const cancelMnReminderMutation: {
    id: "cancelMnReminderMutation";
    op: string;
    query: string;
};
export declare const mnReminderRulesQuery: {
    id: "mnReminderRulesQuery";
    op: string;
    query: string;
};
export declare const createMnReminderRuleMutation: {
    id: "createMnReminderRuleMutation";
    op: string;
    query: string;
};
export declare const updateMnReminderRuleMutation: {
    id: "updateMnReminderRuleMutation";
    op: string;
    query: string;
};
export declare const deleteMnReminderRuleMutation: {
    id: "deleteMnReminderRuleMutation";
    op: string;
    query: string;
};
//# sourceMappingURL=graphql.d.ts.map