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

export type MnReleaseRunStatus =
  | 'pending'
  | 'in_progress'
  | 'success'
  | 'failure'
  | 'cancelled';

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

export type MnHeartbeatRunStatus =
  | 'running'
  | 'success'
  | 'failure'
  | 'timed_out';

export interface MnAgentDto {
  id: string;
  workspaceId: string;
  projectId: string | null;
  name: string;
  roleTemplate: string;
  adapterType: string;
  status: MnAgentStatus;
  lastHeartbeatAt: string | null;
  createdAt: string;
  updatedAt: string;
  apiKeys?: MnAgentApiKeyDto[];
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
export type MnApprovalType =
  | 'HIRE_AGENT'
  | 'APPROVE_TASK_COMPLETION'
  | 'BUDGET_OVERRIDE'
  | 'REQUEST_BOARD_APPROVAL'
  | 'TOOL_CALL_REVIEW'
  | 'AGENT_ORG_CHANGE';

export type MnApprovalStatus =
  | 'PENDING'
  | 'REVISION_REQUESTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED';

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
export type MnApprovalEventOp =
  | 'created'
  | 'decided'
  | 'revision-requested'
  | 'resubmitted'
  | 'cancelled';

export interface MnApprovalSseEvent {
  approvalId: string;
  workspaceId: string;
  op: MnApprovalEventOp;
  ts: number;
}
