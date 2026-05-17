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

export const agentRolesQuery = {
  id: 'agentRolesQuery' as const,
  op: 'agentRoles',
  query: `query agentRoles($workspaceId: String!) {
  agentRoles(workspaceId: $workspaceId) {
    id
    workspaceId
    slug
    displayName
    adapter
    responsibility
    escalation
    lastSuccessfulRunId
    lastSeenAt
    createdAt
    updatedAt
  }
}`,
};

export const updateAgentRoleMutation = {
  id: 'updateAgentRoleMutation' as const,
  op: 'updateAgentRole',
  query: `mutation updateAgentRole($workspaceId: String!, $slug: String!, $input: UpdateMnAgentRoleInput!) {
  updateAgentRole(workspaceId: $workspaceId, slug: $slug, input: $input) {
    id
    workspaceId
    slug
    displayName
    adapter
    responsibility
    escalation
    lastSuccessfulRunId
    lastSeenAt
    createdAt
    updatedAt
  }
}`,
};

export const releaseRunsQuery = {
  id: 'releaseRunsQuery' as const,
  op: 'releaseRuns',
  query: `query releaseRuns($workspaceId: String!, $limit: Int, $offset: Int) {
  releaseRuns(workspaceId: $workspaceId, limit: $limit, offset: $offset) {
    id
    workspaceId
    ghRunId
    ghRunUrl
    mode
    status
    version
    shortSha
    headSha
    imageTag
    imageDigest
    registry
    deployUrl
    actor
    generatedAt
    tasks {
      slug
      label
      sortOrder
    }
  }
}`,
};

export const releaseRunQuery = {
  id: 'releaseRunQuery' as const,
  op: 'releaseRun',
  query: `query releaseRun($workspaceId: String!, $runId: ID!) {
  releaseRun(workspaceId: $workspaceId, runId: $runId) {
    id
    workspaceId
    ghRunId
    ghRunUrl
    mode
    status
    version
    shortSha
    headSha
    imageTag
    imageDigest
    registry
    deployUrl
    actor
    generatedAt
    tasks {
      slug
      label
      sortOrder
    }
  }
}`,
};

// ---------------------------------------------------------------------------
// Phase 5 — Agent Identity (M1) operations.
//
// Backend agent B is concurrently shipping the matching @ObjectType /
// @InputType / @Resolver classes (MnAgent, MnAgentApiKey, MnHeartbeatRun).
// Field selection sets here mirror the agreed DTO contract; widen them once
// the codegen run from @affine/graphql picks up the new schema.
// ---------------------------------------------------------------------------

const MN_AGENT_FIELDS = `
    id
    workspaceId
    projectId
    name
    roleTemplate
    adapterType
    status
    lastHeartbeatAt
    createdAt
    updatedAt
`;

const MN_AGENT_API_KEY_FIELDS = `
    id
    agentId
    tokenSuffix
    createdAt
    revokedAt
`;

export const mnAgentsQuery = {
  id: 'mnAgentsQuery' as const,
  op: 'mnAgents',
  query: `query mnAgents($workspaceId: String!, $projectId: String) {
  mnAgents(workspaceId: $workspaceId, projectId: $projectId) {${MN_AGENT_FIELDS}}
}`,
};

export const mnAgentQuery = {
  id: 'mnAgentQuery' as const,
  op: 'mnAgent',
  query: `query mnAgent($id: ID!) {
  mnAgent(id: $id) {${MN_AGENT_FIELDS}
    apiKeys {${MN_AGENT_API_KEY_FIELDS}}
  }
}`,
};

export const mnAgentHeartbeatRunsQuery = {
  id: 'mnAgentHeartbeatRunsQuery' as const,
  op: 'mnAgentHeartbeatRuns',
  query: `query mnAgentHeartbeatRuns($agentId: ID!) {
  mnAgentHeartbeatRuns(agentId: $agentId) {
    id
    agentId
    status
    startedAt
    finishedAt
    durationMs
    errorMessage
  }
}`,
};

export const createMnAgentMutation = {
  id: 'createMnAgentMutation' as const,
  op: 'createMnAgent',
  query: `mutation createMnAgent($input: CreateMnAgentInput!) {
  createMnAgent(input: $input) {${MN_AGENT_FIELDS}}
}`,
};

export const updateMnAgentStatusMutation = {
  id: 'updateMnAgentStatusMutation' as const,
  op: 'updateMnAgentStatus',
  query: `mutation updateMnAgentStatus($id: ID!, $input: UpdateMnAgentStatusInput!) {
  updateMnAgentStatus(id: $id, input: $input) {${MN_AGENT_FIELDS}}
}`,
};

export const deleteMnAgentMutation = {
  id: 'deleteMnAgentMutation' as const,
  op: 'deleteMnAgent',
  query: `mutation deleteMnAgent($id: ID!) {
  deleteMnAgent(id: $id)
}`,
};

export const createMnAgentApiKeyMutation = {
  id: 'createMnAgentApiKeyMutation' as const,
  op: 'createMnAgentApiKey',
  query: `mutation createMnAgentApiKey($input: CreateMnAgentApiKeyInput!) {
  createMnAgentApiKey(input: $input) {${MN_AGENT_API_KEY_FIELDS}
    plaintextToken
  }
}`,
};

export const revokeMnAgentApiKeyMutation = {
  id: 'revokeMnAgentApiKeyMutation' as const,
  op: 'revokeMnAgentApiKey',
  query: `mutation revokeMnAgentApiKey($id: ID!) {
  revokeMnAgentApiKey(id: $id) {${MN_AGENT_API_KEY_FIELDS}}
}`,
};
