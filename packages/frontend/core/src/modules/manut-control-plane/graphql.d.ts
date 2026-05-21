/**
 * Local GraphQL operations for the Manut Control Plane module — Phase 3
 * (Agent Registry), Phase 4 (Release Runs board), and Phase 5 (Agent
 * Identity / M1).
 *
 * Operation-object shape mirrors the codegen output (`{ id, op, query }`) so
 * these can be passed to `useQuery` / `useMutation` from
 * `@affine/core/components/hooks` with a single `as unknown as` cast at the
 * call site. Replace with imports from `@affine/graphql` after the next
 * codegen run picks up the backend resolvers.
 */
export declare const agentRolesQuery: {
    id: "agentRolesQuery";
    op: string;
    query: string;
};
export declare const updateAgentRoleMutation: {
    id: "updateAgentRoleMutation";
    op: string;
    query: string;
};
export declare const releaseRunsQuery: {
    id: "releaseRunsQuery";
    op: string;
    query: string;
};
export declare const releaseRunQuery: {
    id: "releaseRunQuery";
    op: string;
    query: string;
};
export declare const mnAgentsQuery: {
    id: "mnAgentsQuery";
    op: string;
    query: string;
};
export declare const mnAgentQuery: {
    id: "mnAgentQuery";
    op: string;
    query: string;
};
export declare const mnAgentHeartbeatRunsQuery: {
    id: "mnAgentHeartbeatRunsQuery";
    op: string;
    query: string;
};
export declare const createMnAgentMutation: {
    id: "createMnAgentMutation";
    op: string;
    query: string;
};
export declare const updateMnAgentStatusMutation: {
    id: "updateMnAgentStatusMutation";
    op: string;
    query: string;
};
export declare const deleteMnAgentMutation: {
    id: "deleteMnAgentMutation";
    op: string;
    query: string;
};
export declare const createMnAgentApiKeyMutation: {
    id: "createMnAgentApiKeyMutation";
    op: string;
    query: string;
};
export declare const revokeMnAgentApiKeyMutation: {
    id: "revokeMnAgentApiKeyMutation";
    op: string;
    query: string;
};
export declare const enableMnAgentMaximizerMutation: {
    id: "enableMnAgentMaximizerMutation";
    op: string;
    query: string;
};
export declare const disableMnAgentMaximizerMutation: {
    id: "disableMnAgentMaximizerMutation";
    op: string;
    query: string;
};
export declare const mnBudgetsQuery: {
    id: "mnBudgetsQuery";
    op: string;
    query: string;
};
export declare const mnCostEventsQuery: {
    id: "mnCostEventsQuery";
    op: string;
    query: string;
};
export declare const mnBudgetProjectRollupsQuery: {
    id: "mnBudgetProjectRollupsQuery";
    op: string;
    query: string;
};
export declare const createMnBudgetMutation: {
    id: "createMnBudgetMutation";
    op: string;
    query: string;
};
export declare const updateMnBudgetMutation: {
    id: "updateMnBudgetMutation";
    op: string;
    query: string;
};
export declare const deleteMnBudgetMutation: {
    id: "deleteMnBudgetMutation";
    op: string;
    query: string;
};
export declare const mnApprovalsQuery: {
    id: "mnApprovalsQuery";
    op: string;
    query: string;
};
export declare const mnApprovalQuery: {
    id: "mnApprovalQuery";
    op: string;
    query: string;
};
export declare const mnApprovalCommentsQuery: {
    id: "mnApprovalCommentsQuery";
    op: string;
    query: string;
};
export declare const createMnApprovalMutation: {
    id: "createMnApprovalMutation";
    op: string;
    query: string;
};
export declare const decideMnApprovalMutation: {
    id: "decideMnApprovalMutation";
    op: string;
    query: string;
};
export declare const submitMnApprovalRevisionMutation: {
    id: "submitMnApprovalRevisionMutation";
    op: string;
    query: string;
};
export declare const createMnApprovalCommentMutation: {
    id: "createMnApprovalCommentMutation";
    op: string;
    query: string;
};
export declare const mnSkillsQuery: {
    id: "mnSkillsQuery";
    op: string;
    query: string;
};
export declare const mnSkillQuery: {
    id: "mnSkillQuery";
    op: string;
    query: string;
};
export declare const createMnSkillMutation: {
    id: "createMnSkillMutation";
    op: string;
    query: string;
};
export declare const updateMnSkillMutation: {
    id: "updateMnSkillMutation";
    op: string;
    query: string;
};
export declare const archiveMnSkillMutation: {
    id: "archiveMnSkillMutation";
    op: string;
    query: string;
};
export declare const exportWorkspaceSnapshotMutation: {
    id: "exportWorkspaceSnapshotMutation";
    op: string;
    query: string;
};
export declare const mnPluginsQuery: {
    id: "mnPluginsQuery";
    op: string;
    query: string;
};
export declare const mnPluginQuery: {
    id: "mnPluginQuery";
    op: string;
    query: string;
};
export declare const mnPluginConfigsQuery: {
    id: "mnPluginConfigsQuery";
    op: string;
    query: string;
};
export declare const installMnPluginMutation: {
    id: "installMnPluginMutation";
    op: string;
    query: string;
};
export declare const enableMnPluginMutation: {
    id: "enableMnPluginMutation";
    op: string;
    query: string;
};
export declare const disableMnPluginMutation: {
    id: "disableMnPluginMutation";
    op: string;
    query: string;
};
export declare const uninstallMnPluginMutation: {
    id: "uninstallMnPluginMutation";
    op: string;
    query: string;
};
export declare const upsertMnPluginConfigMutation: {
    id: "upsertMnPluginConfigMutation";
    op: string;
    query: string;
};
export declare const mnOrgChangesQuery: {
    id: "mnOrgChangesQuery";
    op: string;
    query: string;
};
export declare const proposeMnOrgChangeMutation: {
    id: "proposeMnOrgChangeMutation";
    op: string;
    query: string;
};
export declare const decideMnOrgChangeMutation: {
    id: "decideMnOrgChangeMutation";
    op: string;
    query: string;
};
export declare const applyMnOrgChangeMutation: {
    id: "applyMnOrgChangeMutation";
    op: string;
    query: string;
};
export declare const revertMnOrgChangeMutation: {
    id: "revertMnOrgChangeMutation";
    op: string;
    query: string;
};
export declare const mnCeoConversationsQuery: {
    id: "mnCeoConversationsQuery";
    op: string;
    query: string;
};
export declare const mnCeoConversationQuery: {
    id: "mnCeoConversationQuery";
    op: string;
    query: string;
};
export declare const mnCeoTurnsQuery: {
    id: "mnCeoTurnsQuery";
    op: string;
    query: string;
};
export declare const createMnCeoConversationMutation: {
    id: "createMnCeoConversationMutation";
    op: string;
    query: string;
};
export declare const addMnCeoTurnMutation: {
    id: "addMnCeoTurnMutation";
    op: string;
    query: string;
};
export declare const resolveMnCeoTurnMutation: {
    id: "resolveMnCeoTurnMutation";
    op: string;
    query: string;
};
//# sourceMappingURL=graphql.d.ts.map