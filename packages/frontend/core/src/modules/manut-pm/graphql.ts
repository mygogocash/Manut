/**
 * Local GraphQL operations for the Superflow PM (Projects + Tasks) module.
 *
 * Operation-object shape mirrors the codegen output (`{ id, op, query }`) so
 * these can be passed to `useQuery` / `useMutation` from
 * `@affine/core/components/hooks` with a single `as unknown as` cast at the
 * call site. Replace with imports from `@affine/graphql` after the next
 * codegen run.
 */

export const mnProjectsQuery = {
  id: 'mnProjectsQuery' as const,
  op: 'mnProjects',
  query: `query mnProjects($workspaceId: String!) {
  mnProjects(workspaceId: $workspaceId) {
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

export const mnTasksQuery = {
  id: 'mnTasksQuery' as const,
  op: 'mnTasks',
  query: `query mnTasks($projectId: ID!) {
  mnTasks(projectId: $projectId) {
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

export const createMnProjectMutation = {
  id: 'createMnProjectMutation' as const,
  op: 'createMnProject',
  query: `mutation createMnProject($workspaceId: String!, $input: CreateMnProjectInput!) {
  createMnProject(workspaceId: $workspaceId, input: $input) {
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

export const updateMnProjectMutation = {
  id: 'updateMnProjectMutation' as const,
  op: 'updateMnProject',
  query: `mutation updateMnProject($projectId: ID!, $input: UpdateMnProjectInput!) {
  updateMnProject(projectId: $projectId, input: $input) {
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

export const archiveMnProjectMutation = {
  id: 'archiveMnProjectMutation' as const,
  op: 'archiveMnProject',
  query: `mutation archiveMnProject($projectId: ID!) {
  archiveMnProject(projectId: $projectId) {
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

export const createMnTaskMutation = {
  id: 'createMnTaskMutation' as const,
  op: 'createMnTask',
  query: `mutation createMnTask($projectId: ID!, $input: CreateMnTaskInput!) {
  createMnTask(projectId: $projectId, input: $input) {
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

export const updateMnTaskMutation = {
  id: 'updateMnTaskMutation' as const,
  op: 'updateMnTask',
  query: `mutation updateMnTask($taskId: ID!, $input: UpdateMnTaskInput!) {
  updateMnTask(taskId: $taskId, input: $input) {
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

export const updateMnTaskStatusMutation = {
  id: 'updateMnTaskStatusMutation' as const,
  op: 'updateMnTaskStatus',
  query: `mutation updateMnTaskStatus($taskId: ID!, $status: MnTaskStatus!) {
  updateMnTaskStatus(taskId: $taskId, status: $status) {
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

export const updateMnTaskMutation = {
  id: 'updateMnTaskMutation' as const,
  op: 'updateMnTask',
  query: `mutation updateMnTask($taskId: ID!, $input: UpdateMnTaskInput!) {
  updateMnTask(taskId: $taskId, input: $input) {
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

export const deleteMnTaskMutation = {
  id: 'deleteMnTaskMutation' as const,
  op: 'deleteMnTask',
  query: `mutation deleteMnTask($taskId: ID!) {
  deleteMnTask(taskId: $taskId)
}`,
};
