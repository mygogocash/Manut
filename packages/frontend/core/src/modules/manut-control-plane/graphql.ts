/**
 * Local GraphQL operations for the Manut Control Plane module — Phase 3
 * (Agent Registry) and Phase 4 (Release Runs board).
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
