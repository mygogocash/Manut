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
