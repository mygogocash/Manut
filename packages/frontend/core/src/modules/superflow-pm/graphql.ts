/**
 * Local GraphQL operations for the Superflow PM (Projects + Tasks) module.
 *
 * Operation-object shape mirrors the codegen output (`{ id, op, query }`) so
 * these can be passed to `useQuery` / `useMutation` from
 * `@affine/core/components/hooks` with a single `as unknown as` cast at the
 * call site. Replace with imports from `@affine/graphql` after the next
 * codegen run.
 */

export const sfProjectsQuery = {
  id: 'sfProjectsQuery' as const,
  op: 'sfProjects',
  query: `query sfProjects($workspaceId: String!) {
  sfProjects(workspaceId: $workspaceId) {
    id
    workspaceId
    name
    description
    status
    sortOrder
    createdAt
    updatedAt
  }
}`,
};

export const sfTasksQuery = {
  id: 'sfTasksQuery' as const,
  op: 'sfTasks',
  query: `query sfTasks($projectId: ID!) {
  sfTasks(projectId: $projectId) {
    id
    projectId
    title
    description
    status
    priority
    dueAt
    listSortOrder
    assigneeUserId
    createdByUserId
    createdAt
    updatedAt
  }
}`,
};

export const createSfProjectMutation = {
  id: 'createSfProjectMutation' as const,
  op: 'createSfProject',
  query: `mutation createSfProject($workspaceId: String!, $input: CreateSfProjectInput!) {
  createSfProject(workspaceId: $workspaceId, input: $input) {
    id
    workspaceId
    name
    description
    status
    sortOrder
    createdAt
    updatedAt
  }
}`,
};

export const createSfTaskMutation = {
  id: 'createSfTaskMutation' as const,
  op: 'createSfTask',
  query: `mutation createSfTask($projectId: ID!, $input: CreateSfTaskInput!) {
  createSfTask(projectId: $projectId, input: $input) {
    id
    projectId
    title
    description
    status
    priority
    dueAt
    listSortOrder
    assigneeUserId
    createdByUserId
    createdAt
    updatedAt
  }
}`,
};

export const updateSfTaskStatusMutation = {
  id: 'updateSfTaskStatusMutation' as const,
  op: 'updateSfTaskStatus',
  query: `mutation updateSfTaskStatus($taskId: ID!, $status: SfTaskStatus!) {
  updateSfTaskStatus(taskId: $taskId, status: $status) {
    id
    projectId
    title
    status
    priority
    dueAt
    updatedAt
  }
}`,
};

export const deleteSfTaskMutation = {
  id: 'deleteSfTaskMutation' as const,
  op: 'deleteSfTask',
  query: `mutation deleteSfTask($taskId: ID!) {
  deleteSfTask(taskId: $taskId)
}`,
};
