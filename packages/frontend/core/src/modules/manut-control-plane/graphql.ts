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

// ---------------------------------------------------------------------------
// Phase 6 — Budget + cost events (M4) operations.
// ---------------------------------------------------------------------------

const MN_BUDGET_FIELDS = `
    id
    workspaceId
    projectId
    scopeType
    scopeId
    monthYear
    capCents
    spentCents
    warnThresholdPct
    hardStopEnabled
    alertSent
    createdAt
    updatedAt
`;

const MN_COST_EVENT_FIELDS = `
    id
    workspaceId
    projectId
    agentId
    taskId
    goalId
    billingCode
    provider
    model
    inputTokens
    outputTokens
    costCents
    occurredAt
`;

const MN_BUDGET_ROLLUP_FIELDS = `
    scopeType
    scopeId
    projectId
    monthYear
    capCents
    spentCents
    utilizationPct
`;

export const mnBudgetsQuery = {
  id: 'mnBudgetsQuery' as const,
  op: 'mnBudgets',
  query: `query mnBudgets($workspaceId: ID!, $monthYear: String, $scopeType: MnBudgetScope) {
  mnBudgets(workspaceId: $workspaceId, monthYear: $monthYear, scopeType: $scopeType) {${MN_BUDGET_FIELDS}}
}`,
};

export const mnCostEventsQuery = {
  id: 'mnCostEventsQuery' as const,
  op: 'mnCostEvents',
  query: `query mnCostEvents($workspaceId: ID!, $projectId: ID, $agentId: ID, $taskId: ID, $monthYear: String, $limit: Int) {
  mnCostEvents(workspaceId: $workspaceId, projectId: $projectId, agentId: $agentId, taskId: $taskId, monthYear: $monthYear, limit: $limit) {${MN_COST_EVENT_FIELDS}}
}`,
};

export const mnBudgetProjectRollupsQuery = {
  id: 'mnBudgetProjectRollupsQuery' as const,
  op: 'mnBudgetProjectRollups',
  query: `query mnBudgetProjectRollups($workspaceId: ID!, $monthYear: String!) {
  mnBudgetProjectRollups(workspaceId: $workspaceId, monthYear: $monthYear) {${MN_BUDGET_ROLLUP_FIELDS}}
}`,
};

export const createMnBudgetMutation = {
  id: 'createMnBudgetMutation' as const,
  op: 'createMnBudget',
  query: `mutation createMnBudget($workspaceId: ID!, $input: CreateMnBudgetInput!) {
  createMnBudget(workspaceId: $workspaceId, input: $input) {${MN_BUDGET_FIELDS}}
}`,
};

export const updateMnBudgetMutation = {
  id: 'updateMnBudgetMutation' as const,
  op: 'updateMnBudget',
  query: `mutation updateMnBudget($workspaceId: ID!, $budgetId: ID!, $input: UpdateMnBudgetInput!) {
  updateMnBudget(workspaceId: $workspaceId, budgetId: $budgetId, input: $input) {${MN_BUDGET_FIELDS}}
}`,
};

export const deleteMnBudgetMutation = {
  id: 'deleteMnBudgetMutation' as const,
  op: 'deleteMnBudget',
  query: `mutation deleteMnBudget($workspaceId: ID!, $budgetId: ID!) {
  deleteMnBudget(workspaceId: $workspaceId, budgetId: $budgetId)
}`,
};

// ---------------------------------------------------------------------------
// Phase 6 — Approvals + reviews (M3) operations.
// ---------------------------------------------------------------------------

const MN_APPROVAL_FIELDS = `
    id
    workspaceId
    projectId
    type
    requestedByAgentId
    requestedByUserId
    status
    payload
    decisionNote
    decidedByUserId
    decidedAt
    createdAt
    updatedAt
`;

const MN_APPROVAL_COMMENT_FIELDS = `
    id
    approvalId
    projectId
    authorAgentId
    authorUserId
    body
    createdAt
`;

export const mnApprovalsQuery = {
  id: 'mnApprovalsQuery' as const,
  op: 'mnApprovals',
  query: `query mnApprovals($workspaceId: ID!, $filter: ListMnApprovalsInput) {
  mnApprovals(workspaceId: $workspaceId, filter: $filter) {${MN_APPROVAL_FIELDS}}
}`,
};

export const mnApprovalQuery = {
  id: 'mnApprovalQuery' as const,
  op: 'mnApproval',
  query: `query mnApproval($workspaceId: ID!, $approvalId: ID!) {
  mnApproval(workspaceId: $workspaceId, approvalId: $approvalId) {${MN_APPROVAL_FIELDS}}
}`,
};

export const mnApprovalCommentsQuery = {
  id: 'mnApprovalCommentsQuery' as const,
  op: 'mnApprovalComments',
  query: `query mnApprovalComments($workspaceId: ID!, $approvalId: ID!) {
  mnApprovalComments(workspaceId: $workspaceId, approvalId: $approvalId) {${MN_APPROVAL_COMMENT_FIELDS}}
}`,
};

export const createMnApprovalMutation = {
  id: 'createMnApprovalMutation' as const,
  op: 'createMnApproval',
  query: `mutation createMnApproval($workspaceId: ID!, $input: CreateMnApprovalInput!) {
  createMnApproval(workspaceId: $workspaceId, input: $input) {${MN_APPROVAL_FIELDS}}
}`,
};

export const decideMnApprovalMutation = {
  id: 'decideMnApprovalMutation' as const,
  op: 'decideMnApproval',
  query: `mutation decideMnApproval($workspaceId: ID!, $approvalId: ID!, $input: DecideMnApprovalInput!) {
  decideMnApproval(workspaceId: $workspaceId, approvalId: $approvalId, input: $input) {${MN_APPROVAL_FIELDS}}
}`,
};

export const submitMnApprovalRevisionMutation = {
  id: 'submitMnApprovalRevisionMutation' as const,
  op: 'submitMnApprovalRevision',
  query: `mutation submitMnApprovalRevision($workspaceId: ID!, $approvalId: ID!, $payload: JSONObject) {
  submitMnApprovalRevision(workspaceId: $workspaceId, approvalId: $approvalId, payload: $payload) {${MN_APPROVAL_FIELDS}}
}`,
};

export const createMnApprovalCommentMutation = {
  id: 'createMnApprovalCommentMutation' as const,
  op: 'createMnApprovalComment',
  query: `mutation createMnApprovalComment($workspaceId: ID!, $approvalId: ID!, $input: CreateMnApprovalCommentInput!) {
  createMnApprovalComment(workspaceId: $workspaceId, approvalId: $approvalId, input: $input) {${MN_APPROVAL_COMMENT_FIELDS}}
}`,
};

// ---------------------------------------------------------------------------
// Phase 7 — Skills + portability (M5) operations.
//
// Backend agent A is concurrently shipping the matching @ObjectType /
// @InputType / @Resolver classes (MnSkill, MnExportSnapshot). Field
// selection sets here mirror the agreed DTO contract; widen them once the
// codegen run from @affine/graphql picks up the new schema.
// ---------------------------------------------------------------------------

const MN_SKILL_FIELDS = `
    id
    workspaceId
    slug
    name
    version
    source
    body
    archivedAt
    createdAt
    updatedAt
`;

const MN_EXPORT_SNAPSHOT_FIELDS = `
    workspaceId
    generatedAt
    blobBase64
    sha256
    sizeBytes
`;

export const mnSkillsQuery = {
  id: 'mnSkillsQuery' as const,
  op: 'mnSkills',
  query: `query mnSkills($workspaceId: ID!, $includeArchived: Boolean) {
  mnSkills(workspaceId: $workspaceId, includeArchived: $includeArchived) {${MN_SKILL_FIELDS}}
}`,
};

export const mnSkillQuery = {
  id: 'mnSkillQuery' as const,
  op: 'mnSkill',
  query: `query mnSkill($id: ID!) {
  mnSkill(id: $id) {${MN_SKILL_FIELDS}}
}`,
};

export const createMnSkillMutation = {
  id: 'createMnSkillMutation' as const,
  op: 'createMnSkill',
  query: `mutation createMnSkill($input: CreateMnSkillInput!) {
  createMnSkill(input: $input) {${MN_SKILL_FIELDS}}
}`,
};

export const updateMnSkillMutation = {
  id: 'updateMnSkillMutation' as const,
  op: 'updateMnSkill',
  query: `mutation updateMnSkill($id: ID!, $input: UpdateMnSkillInput!) {
  updateMnSkill(id: $id, input: $input) {${MN_SKILL_FIELDS}}
}`,
};

export const archiveMnSkillMutation = {
  id: 'archiveMnSkillMutation' as const,
  op: 'archiveMnSkill',
  query: `mutation archiveMnSkill($id: ID!) {
  archiveMnSkill(id: $id) {${MN_SKILL_FIELDS}}
}`,
};

export const exportWorkspaceSnapshotMutation = {
  id: 'exportWorkspaceSnapshotMutation' as const,
  op: 'exportWorkspaceSnapshot',
  query: `mutation exportWorkspaceSnapshot($workspaceId: ID!) {
  exportWorkspaceSnapshot(workspaceId: $workspaceId) {${MN_EXPORT_SNAPSHOT_FIELDS}}
}`,
};
