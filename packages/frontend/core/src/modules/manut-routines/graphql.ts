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

const ROUTINE_FIELDS = `
    id
    workspaceId
    ownerId
    visibility
    name
    description
    prompt
    cronSchedule
    timezone
    status
    lastRunAt
    nextRunAt
    createdAt
    updatedAt`;

const ROUTINE_RUN_FIELDS = `
    id
    routineId
    triggeredBy
    triggerType
    status
    output
    errorMessage
    durationMs
    startedAt
    finishedAt
    createdAt`;

export const mnRoutinesQuery = {
  id: 'mnRoutinesQuery' as const,
  op: 'mnRoutines',
  query: `query mnRoutines($workspaceId: ID!) {
  mnRoutines(workspaceId: $workspaceId) {${ROUTINE_FIELDS}
  }
}`,
};

export const mnRoutineRunsQuery = {
  id: 'mnRoutineRunsQuery' as const,
  op: 'mnRoutineRuns',
  query: `query mnRoutineRuns($routineId: ID!, $limit: Int) {
  mnRoutineRuns(routineId: $routineId, limit: $limit) {${ROUTINE_RUN_FIELDS}
  }
}`,
};

export const createMnRoutineMutation = {
  id: 'createMnRoutineMutation' as const,
  op: 'createMnRoutine',
  query: `mutation createMnRoutine($workspaceId: ID!, $input: CreateMnRoutineInput!) {
  createMnRoutine(workspaceId: $workspaceId, input: $input) {${ROUTINE_FIELDS}
  }
}`,
};

export const updateMnRoutineMutation = {
  id: 'updateMnRoutineMutation' as const,
  op: 'updateMnRoutine',
  query: `mutation updateMnRoutine($id: ID!, $input: UpdateMnRoutineInput!) {
  updateMnRoutine(id: $id, input: $input) {${ROUTINE_FIELDS}
  }
}`,
};

export const deleteMnRoutineMutation = {
  id: 'deleteMnRoutineMutation' as const,
  op: 'deleteMnRoutine',
  query: `mutation deleteMnRoutine($id: ID!) {
  deleteMnRoutine(id: $id)
}`,
};

export const pauseMnRoutineMutation = {
  id: 'pauseMnRoutineMutation' as const,
  op: 'pauseMnRoutine',
  query: `mutation pauseMnRoutine($id: ID!) {
  pauseMnRoutine(id: $id) {${ROUTINE_FIELDS}
  }
}`,
};

export const resumeMnRoutineMutation = {
  id: 'resumeMnRoutineMutation' as const,
  op: 'resumeMnRoutine',
  query: `mutation resumeMnRoutine($id: ID!) {
  resumeMnRoutine(id: $id) {${ROUTINE_FIELDS}
  }
}`,
};

export const runMnRoutineMutation = {
  id: 'runMnRoutineMutation' as const,
  op: 'runMnRoutine',
  query: `mutation runMnRoutine($id: ID!) {
  runMnRoutine(id: $id) {${ROUTINE_RUN_FIELDS}
  }
}`,
};
