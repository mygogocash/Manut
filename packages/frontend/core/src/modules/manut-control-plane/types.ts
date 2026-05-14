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
