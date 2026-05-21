/**
 * Frontend types for the Manut Control Plane module — agent registry
 * (`MnAgentRole`) and release runs (`MnReleaseRun`).
 *
 * Mirrors the backend DTOs in the Manut control-plane plugin and the
 * Prisma `MnAgentRole` / `MnReleaseRun` models. Co-located with the
 * frontend call sites because `@affine/graphql` codegen has not been
 * re-run for these operations yet — replace with imports from
 * `@affine/graphql` after the next codegen run.
 */
export type MnReleaseRunStatus = 'pending' | 'in_progress' | 'success' | 'failure' | 'cancelled';
/**
 * One of the five operating roles per the control-plane spec
 * (`docs/MANUT_CONTROL_PLANE.md` "Operating Roles" table). The slug is the
 * stable identifier; `displayName` is editable.
 */
export interface MnAgentRoleDto {
    id: string;
    workspaceId: string;
    slug: string;
    displayName: string;
    adapter: string;
    responsibility: string;
    escalation: string | null;
    lastSuccessfulRunId: string | null;
    lastSeenAt: string | null;
    createdAt: string;
    updatedAt: string;
}
export interface UpdateMnAgentRoleInput {
    displayName?: string | null;
    adapter?: string | null;
    escalation?: string | null;
}
export interface MnReleaseRunTaskDto {
    slug: string;
    label: string;
    sortOrder: number;
}
export interface MnReleaseRunDto {
    id: string;
    workspaceId: string;
    ghRunId: string | null;
    ghRunUrl: string | null;
    mode: string;
    status: MnReleaseRunStatus;
    version: string | null;
    shortSha: string | null;
    headSha: string | null;
    imageTag: string | null;
    imageDigest: string | null;
    registry: string | null;
    deployUrl: string | null;
    actor: string | null;
    generatedAt: string;
    tasks: MnReleaseRunTaskDto[];
}
/**
 * Phase 5 — Agent Identity (M1).
 *
 * `MnAgent` is the per-workspace registered worker — distinct from
 * `MnAgentRole` (the five fixed operating slots). Agents bind to a project
 * and a role template, expose API keys for adapters to authenticate with,
 * and emit heartbeats while running.
 */
export type MnAgentStatus = 'active' | 'paused' | 'terminated';
export type MnHeartbeatRunStatus = 'running' | 'success' | 'failure' | 'timed_out';
export interface MnAgentDto {
    id: string;
    workspaceId: string;
    projectId: string | null;
    name: string;
    roleTemplate: string;
    adapterType: string;
    status: MnAgentStatus;
    /**
     * M12 — MAXIMIZER MODE flag. Optional on the DTO because older
     * server bundles deployed before M12 won't return the column;
     * the UI defaults a missing value to `false` so the toggle renders
     * safely.
     */
    maximizerMode?: boolean;
    lastHeartbeatAt: string | null;
    createdAt: string;
    updatedAt: string;
    apiKeys?: MnAgentApiKeyDto[];
}
export interface MnAgentMaximizerToggleResultDto {
    agentId: string;
    maximizerMode: boolean;
}
export interface MnAgentApiKeyDto {
    id: string;
    agentId: string;
    /** Last 4 chars of the secret; full secret is only returned on mint. */
    tokenSuffix: string;
    /** Plaintext bearer token — present ONLY in the `createMnAgentApiKey` response. */
    plaintextToken?: string | null;
    createdAt: string;
    revokedAt: string | null;
}
export interface MnHeartbeatRunDto {
    id: string;
    agentId: string;
    status: MnHeartbeatRunStatus;
    startedAt: string;
    finishedAt: string | null;
    durationMs: number | null;
    errorMessage: string | null;
}
export interface CreateMnAgentInput {
    workspaceId: string;
    projectId?: string | null;
    name: string;
    roleTemplate: string;
    adapterType?: string | null;
}
export interface UpdateMnAgentStatusInput {
    status: MnAgentStatus;
}
export interface CreateMnAgentApiKeyInput {
    agentId: string;
}
/**
 * Phase 6 — Budget + cost events (M4).
 *
 * Mirrors `MnBudgetObjectType` / `MnCostEventObjectType` /
 * `MnBudgetRollupObjectType` in the backend (`manut-budget.dto.ts`).
 */
export type MnBudgetScope = 'WORKSPACE' | 'PROJECT' | 'AGENT' | 'TASK' | 'GOAL';
export interface MnBudgetDto {
    id: string;
    workspaceId: string;
    projectId: string | null;
    scopeType: MnBudgetScope;
    scopeId: string | null;
    /** YYYY-MM (UTC). */
    monthYear: string;
    capCents: number;
    spentCents: number;
    warnThresholdPct: number;
    hardStopEnabled: boolean;
    alertSent: boolean;
    createdAt: string;
    updatedAt: string;
}
export interface MnCostEventDto {
    id: string;
    workspaceId: string;
    projectId: string | null;
    agentId: string | null;
    taskId: string | null;
    goalId: string | null;
    billingCode: string | null;
    provider: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    costCents: number;
    occurredAt: string;
}
export interface MnBudgetRollupDto {
    scopeType: MnBudgetScope;
    scopeId: string | null;
    projectId: string | null;
    monthYear: string;
    capCents: number;
    spentCents: number;
    utilizationPct: number;
}
export interface CreateMnBudgetInput {
    scopeType: MnBudgetScope;
    scopeId?: string | null;
    projectId?: string | null;
    monthYear: string;
    capCents: number;
    warnThresholdPct?: number | null;
    hardStopEnabled?: boolean | null;
}
export interface UpdateMnBudgetInput {
    capCents?: number | null;
    warnThresholdPct?: number | null;
    hardStopEnabled?: boolean | null;
}
/**
 * Phase 6 — Approvals + reviews (M3).
 *
 * Mirrors backend `MnApproval` / `MnApprovalComment` DTOs from
 * `packages/backend/server/src/plugins/manut/manut-approval.dto.ts`.
 * Replace with imports from `@affine/graphql` after the next codegen
 * run picks up the new resolvers.
 */
export type MnApprovalType = 'HIRE_AGENT' | 'APPROVE_TASK_COMPLETION' | 'BUDGET_OVERRIDE' | 'REQUEST_BOARD_APPROVAL' | 'TOOL_CALL_REVIEW' | 'AGENT_ORG_CHANGE';
export type MnApprovalStatus = 'PENDING' | 'REVISION_REQUESTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export interface MnApprovalDto {
    id: string;
    workspaceId: string;
    projectId: string;
    type: MnApprovalType;
    requestedByAgentId: string | null;
    requestedByUserId: string | null;
    status: MnApprovalStatus;
    payload: Record<string, unknown>;
    decisionNote: string | null;
    decidedByUserId: string | null;
    decidedAt: string | null;
    createdAt: string;
    updatedAt: string;
}
export interface MnApprovalCommentDto {
    id: string;
    approvalId: string;
    projectId: string;
    authorAgentId: string | null;
    authorUserId: string | null;
    body: string;
    createdAt: string;
}
export interface CreateMnApprovalInput {
    workspaceId: string;
    projectId: string;
    type: MnApprovalType;
    payload?: Record<string, unknown> | null;
    requestedByAgentId?: string | null;
}
export interface DecideMnApprovalInput {
    status: MnApprovalStatus;
    decisionNote?: string | null;
}
export interface CreateMnApprovalCommentInput {
    body: string;
    authorAgentId?: string | null;
}
export interface ListMnApprovalsInput {
    projectId?: string | null;
    statuses?: MnApprovalStatus[] | null;
    types?: MnApprovalType[] | null;
    requestedByAgentId?: string | null;
    limit?: number | null;
}
/**
 * SSE message shape from `/api/workspace/:workspaceId/approvals-stream`.
 */
export type MnApprovalEventOp = 'created' | 'decided' | 'revision-requested' | 'resubmitted' | 'cancelled';
export interface MnApprovalSseEvent {
    approvalId: string;
    workspaceId: string;
    op: MnApprovalEventOp;
    ts: number;
}
/**
 * Phase 7 — Skills + portability (M5).
 *
 * Mirrors backend `MnSkill` DTO from
 * `packages/backend/server/src/plugins/manut/manut-skill.dto.ts` and the
 * Prisma `MnSkill` model. Skills are markdown documents pinned per
 * workspace + version, optionally archived. `exportWorkspaceSnapshot`
 * mutation returns a base64-encoded blob + SHA256 hash for offline
 * archival.
 *
 * Replace with imports from `@affine/graphql` after the next codegen
 * run picks up the new resolvers.
 */
export type MnSkillSource = 'CUSTOM' | 'SEED' | 'IMPORTED';
export interface MnSkillDto {
    id: string;
    workspaceId: string;
    slug: string;
    name: string;
    version: string;
    source: MnSkillSource;
    /** Markdown body. May be very large for richly authored skills. */
    body: string;
    archivedAt: string | null;
    createdAt: string;
    updatedAt: string;
}
export interface CreateMnSkillInput {
    workspaceId: string;
    slug: string;
    name: string;
    version: string;
    body: string;
    source?: MnSkillSource | null;
}
export interface UpdateMnSkillInput {
    name?: string | null;
    version?: string | null;
    body?: string | null;
    source?: MnSkillSource | null;
}
export interface MnExportSnapshotDto {
    workspaceId: string;
    /** ISO-8601 timestamp at which the snapshot was generated. */
    generatedAt: string;
    /** Base64-encoded blob containing the full export payload. */
    blobBase64: string;
    /** SHA-256 hash of the raw (pre-base64) blob, hex-encoded. */
    sha256: string;
    /** Pre-decoded byte length of the blob, useful for UI display. */
    sizeBytes: number;
}
/**
 * Phase 8 — M6b plugin runtime UI surface.
 *
 * Mirrors backend DTOs in
 * `packages/backend/server/src/plugins/manut/plugin-runtime/manut-plugin.dto.ts`.
 * The `MnPluginConfig` row is per-workspace; `configJson.enabled` is the
 * well-known boolean the UI toggle flips, but plugin authors may hang
 * arbitrary config off it (api keys, feature flags, capability overrides).
 *
 * Replace with imports from `@affine/graphql` after the next codegen run
 * picks up the M6a + M6b resolvers.
 */
export type MnPluginStatus = 'INSTALLED' | 'LOADING' | 'RUNNING' | 'CRASHED' | 'DISABLED';
export interface MnPluginManifestDto {
    name: string;
    version: string;
    hostApiVersion: string;
    capabilities: string[];
    tools?: Array<{
        name: string;
        description?: string | null;
    }>;
    apiRoutes?: Array<{
        method: string;
        path: string;
        capability: string;
    }>;
}
export interface MnPluginDto {
    id: string;
    name: string;
    version: string;
    /** Parsed plugin manifest (JSON column). */
    manifestJson: MnPluginManifestDto;
    packagePath: string | null;
    processStatus: MnPluginStatus;
    enabledAt: string | null;
    installedAt: string;
    createdAt: string;
    updatedAt: string;
}
export interface MnPluginConfigDto {
    id: string;
    pluginId: string;
    workspaceId: string;
    projectId: string | null;
    /**
     * Opaque per-workspace config. `enabled: boolean` is the toggle the UI
     * flips; other keys are documented by individual plugin authors.
     */
    configJson: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
}
export interface CreateMnPluginInput {
    name: string;
    version: string;
}
export interface UpsertMnPluginConfigInput {
    workspaceId: string;
    pluginId: string;
    projectId?: string | null;
    configJson: Record<string, unknown>;
}
/**
 * Phase 15 — Self-Organization (M15).
 *
 * Mirrors backend DTOs in
 * `packages/backend/server/src/plugins/manut/manut-org-change.dto.ts`.
 * Replace with imports from `@affine/graphql` after the next codegen
 * run picks up the new resolvers.
 */
export type MnOrgChangeType = 'ROLE_ADJUSTMENT' | 'DELEGATION_CHANGE' | 'NEW_ROUTINE' | 'AGENT_HIRE_PROPOSAL' | 'REPORTING_CHANGE' | 'CAPABILITY_GRANT';
export type MnOrgChangeStatus = 'PROPOSED' | 'APPROVED' | 'REJECTED' | 'APPLIED' | 'REVERTED';
export interface MnOrgChangeDto {
    id: string;
    workspaceId: string;
    projectId: string;
    type: MnOrgChangeType;
    proposedByAgentId: string | null;
    status: MnOrgChangeStatus;
    payload: Record<string, unknown>;
    rationale: string;
    decisionNote: string | null;
    decidedByUserId: string | null;
    decidedAt: string | null;
    appliedAt: string | null;
    createdAt: string;
}
export interface ProposeMnOrgChangeInput {
    projectId: string;
    type: MnOrgChangeType;
    payload: Record<string, unknown>;
    rationale: string;
    proposedByAgentId?: string | null;
}
export interface DecideMnOrgChangeInput {
    status: MnOrgChangeStatus;
    decisionNote?: string | null;
}
export interface ListMnOrgChangesInput {
    projectId?: string | null;
    statuses?: MnOrgChangeStatus[] | null;
    types?: MnOrgChangeType[] | null;
    proposedByAgentId?: string | null;
    limit?: number | null;
}
/**
 * M17 — CEO Chat. Top-level chat surface that resolves every USER turn
 * to a typed work object (MnTask / MnApproval / MnTaskPlan /
 * DECISION_RECORDED). Backend intent classification is keyword-based
 * today; a follow-up replaces it with the Vertex auto-router.
 */
export type MnCeoTurnRole = 'USER' | 'CEO_AGENT' | 'SYSTEM';
export type MnCeoResolutionKind = 'NONE' | 'TASK_CREATED' | 'APPROVAL_REQUESTED' | 'PLAN_DRAFTED' | 'DECISION_RECORDED' | 'BUDGET_QUERY' | 'STATUS_QUERY';
export interface MnCeoConversationDto {
    id: string;
    workspaceId: string;
    ownerUserId: string;
    title: string | null;
    lastResolutionKind: MnCeoResolutionKind | null;
    createdAt: string;
    updatedAt: string;
}
export interface MnCeoTurnDto {
    id: string;
    conversationId: string;
    role: MnCeoTurnRole;
    bodyMd: string;
    resolutionKind: MnCeoResolutionKind;
    resolutionRefId: string | null;
    createdAt: string;
}
export interface CreateMnCeoConversationInput {
    workspaceId: string;
    title?: string | null;
}
export interface AddMnCeoTurnInput {
    conversationId: string;
    role: MnCeoTurnRole;
    bodyMd: string;
}
//# sourceMappingURL=types.d.ts.map