/**
 * Local GraphQL operations for the Manut PM (Projects + Tasks) module.
 *
 * Operation-object shape mirrors the codegen output (`{ id, op, query }`) so
 * these can be passed to `useQuery` / `useMutation` from
 * `@affine/core/components/hooks` with a single `as unknown as` cast at the
 * call site. Replace with imports from `@affine/graphql` after the next
 * codegen run.
 */
export declare const mnProjectsQuery: {
    id: "mnProjectsQuery";
    op: string;
    query: string;
};
export declare const mnTasksQuery: {
    id: "mnTasksQuery";
    op: string;
    query: string;
};
export declare const createMnProjectMutation: {
    id: "createMnProjectMutation";
    op: string;
    query: string;
};
export declare const updateMnProjectMutation: {
    id: "updateMnProjectMutation";
    op: string;
    query: string;
};
export declare const archiveMnProjectMutation: {
    id: "archiveMnProjectMutation";
    op: string;
    query: string;
};
export declare const createMnTaskMutation: {
    id: "createMnTaskMutation";
    op: string;
    query: string;
};
export declare const updateMnTaskMutation: {
    id: "updateMnTaskMutation";
    op: string;
    query: string;
};
export declare const updateMnTaskStatusMutation: {
    id: "updateMnTaskStatusMutation";
    op: string;
    query: string;
};
export declare const deleteMnTaskMutation: {
    id: "deleteMnTaskMutation";
    op: string;
    query: string;
};
export declare const mnGoalsQuery: {
    id: "mnGoalsQuery";
    op: string;
    query: string;
};
export declare const mnGoalQuery: {
    id: "mnGoalQuery";
    op: string;
    query: string;
};
export declare const mnGoalAncestryQuery: {
    id: "mnGoalAncestryQuery";
    op: string;
    query: string;
};
export declare const mnTaskAncestryQuery: {
    id: "mnTaskAncestryQuery";
    op: string;
    query: string;
};
export declare const createMnGoalMutation: {
    id: "createMnGoalMutation";
    op: string;
    query: string;
};
export declare const updateMnGoalMutation: {
    id: "updateMnGoalMutation";
    op: string;
    query: string;
};
export declare const deleteMnGoalMutation: {
    id: "deleteMnGoalMutation";
    op: string;
    query: string;
};
export declare const setMnTaskParentMutation: {
    id: "setMnTaskParentMutation";
    op: string;
    query: string;
};
export declare const addMnTaskBlockerMutation: {
    id: "addMnTaskBlockerMutation";
    op: string;
    query: string;
};
export declare const removeMnTaskBlockerMutation: {
    id: "removeMnTaskBlockerMutation";
    op: string;
    query: string;
};
export declare const assignMnTaskMutation: {
    id: "assignMnTaskMutation";
    op: string;
    query: string;
};
export declare const bindAiSessionToTaskMutation: {
    id: "bindAiSessionToTaskMutation";
    op: string;
    query: string;
};
export declare const verifyMnTaskDoneQuery: {
    id: "verifyMnTaskDoneQuery";
    op: string;
    query: string;
};
export declare const setMnTaskDefinitionOfDoneMutation: {
    id: "setMnTaskDefinitionOfDoneMutation";
    op: string;
    query: string;
};
export declare const mnWorkProductsQuery: {
    id: "mnWorkProductsQuery";
    op: string;
    query: string;
};
export declare const createMnWorkProductMutation: {
    id: "createMnWorkProductMutation";
    op: string;
    query: string;
};
export declare const deleteMnWorkProductMutation: {
    id: "deleteMnWorkProductMutation";
    op: string;
    query: string;
};
export declare const mnWorkQueuesQuery: {
    id: "mnWorkQueuesQuery";
    op: string;
    query: string;
};
export declare const mnWorkQueueIntakesQuery: {
    id: "mnWorkQueueIntakesQuery";
    op: string;
    query: string;
};
export declare const createMnWorkQueueMutation: {
    id: "createMnWorkQueueMutation";
    op: string;
    query: string;
};
export declare const updateMnWorkQueueMutation: {
    id: "updateMnWorkQueueMutation";
    op: string;
    query: string;
};
export declare const rotateMnWorkQueueTokenMutation: {
    id: "rotateMnWorkQueueTokenMutation";
    op: string;
    query: string;
};
export declare const archiveMnWorkQueueMutation: {
    id: "archiveMnWorkQueueMutation";
    op: string;
    query: string;
};
export declare const mnTaskPlansQuery: {
    id: "mnTaskPlansQuery";
    op: string;
    query: string;
};
export declare const createMnTaskPlanMutation: {
    id: "createMnTaskPlanMutation";
    op: string;
    query: string;
};
export declare const submitMnTaskPlanForReviewMutation: {
    id: "submitMnTaskPlanForReviewMutation";
    op: string;
    query: string;
};
export declare const decideMnTaskPlanMutation: {
    id: "decideMnTaskPlanMutation";
    op: string;
    query: string;
};
//# sourceMappingURL=graphql.d.ts.map