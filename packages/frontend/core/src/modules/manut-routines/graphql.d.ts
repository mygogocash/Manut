/**
 * Temporary local GraphQL operations for the Manut Routines page.
 *
 * Mirrors the codegen operation-object shape (`{ id, op, query }`) so the
 * page can ship alongside the PR #69 backend resolver before `@affine/
 * graphql` has been regenerated. Same trick the Reminders/PM/CRM panels
 * use.
 *
 * Resolver: `packages/backend/server/src/plugins/manut/manut-routine.resolver.ts`.
 */
export declare const mnRoutinesQuery: {
    id: "mnRoutinesQuery";
    op: string;
    query: string;
};
export declare const mnRoutineRunsQuery: {
    id: "mnRoutineRunsQuery";
    op: string;
    query: string;
};
export declare const createMnRoutineMutation: {
    id: "createMnRoutineMutation";
    op: string;
    query: string;
};
export declare const updateMnRoutineMutation: {
    id: "updateMnRoutineMutation";
    op: string;
    query: string;
};
export declare const deleteMnRoutineMutation: {
    id: "deleteMnRoutineMutation";
    op: string;
    query: string;
};
export declare const pauseMnRoutineMutation: {
    id: "pauseMnRoutineMutation";
    op: string;
    query: string;
};
export declare const resumeMnRoutineMutation: {
    id: "resumeMnRoutineMutation";
    op: string;
    query: string;
};
export declare const runMnRoutineMutation: {
    id: "runMnRoutineMutation";
    op: string;
    query: string;
};
//# sourceMappingURL=graphql.d.ts.map