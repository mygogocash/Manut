/**
 * Local GraphQL operations for the Manut PM (Projects + Tasks) module.
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

export const deleteMnTaskMutation = {
  id: 'deleteMnTaskMutation' as const,
  op: 'deleteMnTask',
  query: `mutation deleteMnTask($taskId: ID!) {
  deleteMnTask(taskId: $taskId)
}`,
};

// ---------------------------------------------------------------------------
// M2 — goal hierarchy + task ancestry + blockers + AI session task-link.
// ---------------------------------------------------------------------------

export const mnGoalsQuery = {
  id: 'mnGoalsQuery' as const,
  op: 'mnGoals',
  query: `query mnGoals($workspaceId: ID!, $projectId: ID) {
  mnGoals(workspaceId: $workspaceId, projectId: $projectId) {
    id
    workspaceId
    projectId
    title
    description
    level
    parentGoalId
    ownerAgentId
    status
    createdByUserId
    createdAt
    updatedAt
  }
}`,
};

export const mnGoalQuery = {
  id: 'mnGoalQuery' as const,
  op: 'mnGoal',
  query: `query mnGoal($workspaceId: ID!, $goalId: ID!) {
  mnGoal(workspaceId: $workspaceId, goalId: $goalId) {
    id
    workspaceId
    projectId
    title
    description
    level
    parentGoalId
    ownerAgentId
    status
    createdAt
    updatedAt
  }
}`,
};

export const mnGoalAncestryQuery = {
  id: 'mnGoalAncestryQuery' as const,
  op: 'mnGoalAncestry',
  query: `query mnGoalAncestry($workspaceId: ID!, $goalId: ID!) {
  mnGoalAncestry(workspaceId: $workspaceId, goalId: $goalId) {
    goalId
    title
    level
    status
    depth
  }
}`,
};

export const mnTaskAncestryQuery = {
  id: 'mnTaskAncestryQuery' as const,
  op: 'mnTaskAncestry',
  query: `query mnTaskAncestry($workspaceId: ID!, $taskId: ID!) {
  mnTaskAncestry(workspaceId: $workspaceId, taskId: $taskId) {
    taskId
    taskTitle
    taskAncestors {
      taskId
      title
      depth
    }
    goalChain {
      goalId
      title
      level
      status
      depth
    }
  }
}`,
};

export const createMnGoalMutation = {
  id: 'createMnGoalMutation' as const,
  op: 'createMnGoal',
  query: `mutation createMnGoal($workspaceId: ID!, $input: CreateMnGoalInput!) {
  createMnGoal(workspaceId: $workspaceId, input: $input) {
    id
    workspaceId
    projectId
    title
    description
    level
    parentGoalId
    ownerAgentId
    status
    createdAt
    updatedAt
  }
}`,
};

export const updateMnGoalMutation = {
  id: 'updateMnGoalMutation' as const,
  op: 'updateMnGoal',
  query: `mutation updateMnGoal($workspaceId: ID!, $goalId: ID!, $input: UpdateMnGoalInput!) {
  updateMnGoal(workspaceId: $workspaceId, goalId: $goalId, input: $input) {
    id
    title
    description
    level
    parentGoalId
    ownerAgentId
    status
    updatedAt
  }
}`,
};

export const deleteMnGoalMutation = {
  id: 'deleteMnGoalMutation' as const,
  op: 'deleteMnGoal',
  query: `mutation deleteMnGoal($workspaceId: ID!, $goalId: ID!) {
  deleteMnGoal(workspaceId: $workspaceId, goalId: $goalId)
}`,
};

export const setMnTaskParentMutation = {
  id: 'setMnTaskParentMutation' as const,
  op: 'setMnTaskParent',
  query: `mutation setMnTaskParent($workspaceId: ID!, $taskId: ID!, $parentTaskId: ID) {
  setMnTaskParent(
    workspaceId: $workspaceId
    taskId: $taskId
    parentTaskId: $parentTaskId
  )
}`,
};

export const addMnTaskBlockerMutation = {
  id: 'addMnTaskBlockerMutation' as const,
  op: 'addMnTaskBlocker',
  query: `mutation addMnTaskBlocker($workspaceId: ID!, $input: AddMnTaskBlockerInput!) {
  addMnTaskBlocker(workspaceId: $workspaceId, input: $input) {
    id
    taskId
    blockedByTaskId
    projectId
    createdAt
  }
}`,
};

export const removeMnTaskBlockerMutation = {
  id: 'removeMnTaskBlockerMutation' as const,
  op: 'removeMnTaskBlocker',
  query: `mutation removeMnTaskBlocker($workspaceId: ID!, $blockerId: ID!) {
  removeMnTaskBlocker(workspaceId: $workspaceId, blockerId: $blockerId)
}`,
};

export const assignMnTaskMutation = {
  id: 'assignMnTaskMutation' as const,
  op: 'assignMnTask',
  query: `mutation assignMnTask($workspaceId: ID!, $taskId: ID!, $assigneeUserId: ID, $assigneeAgentId: ID) {
  assignMnTask(
    workspaceId: $workspaceId
    taskId: $taskId
    assigneeUserId: $assigneeUserId
    assigneeAgentId: $assigneeAgentId
  )
}`,
};

export const bindAiSessionToTaskMutation = {
  id: 'bindAiSessionToTaskMutation' as const,
  op: 'bindAiSessionToTask',
  query: `mutation bindAiSessionToTask($workspaceId: ID!, $sessionId: ID!, $taskId: ID) {
  bindAiSessionToTask(
    workspaceId: $workspaceId
    sessionId: $sessionId
    taskId: $taskId
  )
}`,
};
