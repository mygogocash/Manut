/**
 * Frontend types for the Manut PM (Projects + Tasks) module.
 *
 * Mirrors the backend DTOs in
 * `packages/backend/server/src/plugins/manut/manut-pm.dto.ts`
 * and the Prisma enums in `schema.prisma`. Co-located with the frontend
 * call sites because `@affine/graphql` codegen has not been re-run yet
 * for these operations.
 */

export type MnProjectStatus = 'ACTIVE' | 'ARCHIVED';

export type MnTaskStatus =
  | 'BACKLOG'
  | 'TODO'
  | 'IN_PROGRESS'
  | 'DONE'
  | 'CANCELLED';

export type MnTaskPriority = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export const MN_TASK_STATUSES: readonly MnTaskStatus[] = [
  'BACKLOG',
  'TODO',
  'IN_PROGRESS',
  'DONE',
  'CANCELLED',
];

export const MN_TASK_PRIORITIES: readonly MnTaskPriority[] = [
  'NONE',
  'LOW',
  'MEDIUM',
  'HIGH',
  'URGENT',
];

export interface MnProjectDto {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  status: MnProjectStatus;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface MnTaskDto {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: MnTaskStatus;
  priority: MnTaskPriority;
  dueAt: string | null;
  listSortOrder: number;
  assigneeUserId: string | null;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMnProjectInput {
  name: string;
  description?: string | null;
  sortOrder?: number | null;
}

export interface CreateMnTaskInput {
  title: string;
  description?: string | null;
  status?: MnTaskStatus;
  priority?: MnTaskPriority;
  dueAt?: string | null;
  listSortOrder?: number | null;
  assigneeUserId?: string | null;
}

export interface UpdateMnProjectInput {
  name?: string | null;
  description?: string | null;
  status?: MnProjectStatus | null;
  sortOrder?: number | null;
}

export interface UpdateMnTaskInput {
  title?: string | null;
  description?: string | null;
  status?: MnTaskStatus;
  priority?: MnTaskPriority;
  dueAt?: string | null;
  listSortOrder?: number | null;
  assigneeUserId?: string | null;
}

// ---------------------------------------------------------------------------
// M2 — goals, task ancestry, blockers, AI session task-link.
// ---------------------------------------------------------------------------

export type MnGoalLevel = 'PROJECT' | 'TEAM' | 'AGENT' | 'TASK';

export type MnGoalStatus = 'PLANNED' | 'ACTIVE' | 'ACHIEVED' | 'CANCELLED';

export const MN_GOAL_LEVELS: readonly MnGoalLevel[] = [
  'PROJECT',
  'TEAM',
  'AGENT',
  'TASK',
];

export const MN_GOAL_STATUSES: readonly MnGoalStatus[] = [
  'PLANNED',
  'ACTIVE',
  'ACHIEVED',
  'CANCELLED',
];

export interface MnGoalDto {
  id: string;
  workspaceId: string;
  projectId: string;
  title: string;
  description: string | null;
  level: MnGoalLevel;
  parentGoalId: string | null;
  ownerAgentId: string | null;
  status: MnGoalStatus;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMnGoalInput {
  projectId: string;
  title: string;
  description?: string | null;
  level: MnGoalLevel;
  parentGoalId?: string | null;
  ownerAgentId?: string | null;
  status?: MnGoalStatus | null;
}

export interface UpdateMnGoalInput {
  title?: string | null;
  description?: string | null;
  level?: MnGoalLevel | null;
  parentGoalId?: string | null;
  ownerAgentId?: string | null;
  status?: MnGoalStatus | null;
}

export interface MnGoalAncestryStep {
  goalId: string;
  title: string;
  level: MnGoalLevel;
  status: MnGoalStatus;
  depth: number;
}

export interface MnTaskAncestryStep {
  taskId: string;
  title: string;
  depth: number;
}

export interface MnTaskAncestry {
  taskId: string;
  taskTitle: string;
  taskAncestors: MnTaskAncestryStep[];
  goalChain: MnGoalAncestryStep[];
}

export interface MnTaskBlockerDto {
  id: string;
  taskId: string;
  blockedByTaskId: string;
  projectId: string;
  createdAt: string;
}

export interface AddMnTaskBlockerInput {
  taskId: string;
  blockedByTaskId: string;
}

// ---------------------------------------------------------------------------
// M11 — Enforced Outcomes (Definition of Done).
//
// Mirrors the backend Zod schema in
// `packages/backend/server/src/plugins/manut/manut-outcome-verifier.dto.ts`.
// The discriminated union shape lets the frontend renderer pick the
// right editor (URL input, doc picker, etc.) per predicate kind.
// ---------------------------------------------------------------------------

export type MnDoDPredicateKind =
  | 'DOC_EXISTS'
  | 'URL_REACHABLE'
  | 'WORK_PRODUCT_EXISTS'
  | 'EMBEDDING_SIMILARITY'
  | 'CUSTOM';

export const MN_DOD_PREDICATE_KINDS: readonly MnDoDPredicateKind[] = [
  'DOC_EXISTS',
  'URL_REACHABLE',
  'WORK_PRODUCT_EXISTS',
  'EMBEDDING_SIMILARITY',
  'CUSTOM',
];

export interface MnDoDDocExistsPredicate {
  kind: 'DOC_EXISTS';
  docId: string;
}

export interface MnDoDUrlReachablePredicate {
  kind: 'URL_REACHABLE';
  url: string;
  expectedStatus?: number;
}

export interface MnDoDWorkProductExistsPredicate {
  kind: 'WORK_PRODUCT_EXISTS';
  taskId: string;
  productKind?: string;
}

export interface MnDoDEmbeddingSimilarityPredicate {
  kind: 'EMBEDDING_SIMILARITY';
  sourceText: string;
  threshold: number;
}

export interface MnDoDCustomPredicate {
  kind: 'CUSTOM';
  description: string;
}

export type MnDoDPredicate =
  | MnDoDDocExistsPredicate
  | MnDoDUrlReachablePredicate
  | MnDoDWorkProductExistsPredicate
  | MnDoDEmbeddingSimilarityPredicate
  | MnDoDCustomPredicate;

export interface MnDoDPredicateResult {
  predicate: MnDoDPredicate;
  satisfied: boolean;
  kind: MnDoDPredicateKind;
  evidence: Record<string, unknown> | null;
  reason: string | null;
}

export interface MnDoDVerificationResult {
  taskId: string;
  satisfied: boolean;
  hasDefinition: boolean;
  results: MnDoDPredicateResult[];
}

export interface SetMnTaskDefinitionOfDoneInput {
  taskId: string;
  predicates: MnDoDPredicate[] | null;
}

// ---------------------------------------------------------------------------
// M10 — Artifacts & Work Products.
// ---------------------------------------------------------------------------

export type MnWorkProductKind =
  | 'DOC'
  | 'FILE'
  | 'URL'
  | 'PR'
  | 'DEPLOYMENT'
  | 'CSV'
  | 'SCREENSHOT';

export const MN_WORK_PRODUCT_KINDS: readonly MnWorkProductKind[] = [
  'DOC',
  'FILE',
  'URL',
  'PR',
  'DEPLOYMENT',
  'CSV',
  'SCREENSHOT',
];

export interface MnWorkProductDto {
  id: string;
  workspaceId: string;
  projectId: string;
  taskId: string;
  producedByAgentId: string | null;
  kind: MnWorkProductKind;
  ref: string;
  byteSize: number | null;
  title: string | null;
  description: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface CreateMnWorkProductInput {
  taskId: string;
  kind: MnWorkProductKind;
  ref: string;
  byteSize?: number | null;
  title?: string | null;
  description?: string | null;
  producedByAgentId?: string | null;
  metadata?: Record<string, unknown> | null;
}

// ---------------------------------------------------------------------------
// M14 — Work queues. Intake routing for continuous external inputs.
// ---------------------------------------------------------------------------

export type MnIntakeStatus = 'RECEIVED' | 'ROUTED' | 'REJECTED';

export const MN_INTAKE_STATUSES: readonly MnIntakeStatus[] = [
  'RECEIVED',
  'ROUTED',
  'REJECTED',
];

/**
 * Routing-rule shape mirrored from the backend service. `routingRulesJson`
 * on `MnWorkQueueDto` is the JSON-stringified array of these.
 */
export type MnWorkQueueRuleOp = 'eq' | 'contains';

export interface MnWorkQueueRuleMatch {
  field: string;
  op: MnWorkQueueRuleOp;
  value: string;
}

export interface MnWorkQueueRule {
  match: MnWorkQueueRuleMatch;
  assignToAgentId?: string;
  assignToRoleSlug?: string;
}

export interface MnWorkQueueDto {
  id: string;
  workspaceId: string;
  projectId: string;
  name: string;
  description: string | null;
  intakeWebhookToken: string;
  /** JSON-stringified routing rules array; parse with JSON.parse on read. */
  routingRulesJson: string;
  defaultAssigneeAgentId: string | null;
  defaultPriority: MnTaskPriority;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MnWorkQueueIntakeDto {
  id: string;
  queueId: string;
  externalRef: string | null;
  /** JSON-stringified payload; parse with JSON.parse on read. */
  payloadJson: string;
  status: MnIntakeStatus;
  routedToTaskId: string | null;
  receivedAt: string;
}

export interface CreateMnWorkQueueInput {
  projectId: string;
  name: string;
  description?: string | null;
  routingRulesJson?: string | null;
  defaultAssigneeAgentId?: string | null;
  defaultPriority?: MnTaskPriority | null;
}

export interface UpdateMnWorkQueueInput {
  name?: string | null;
  description?: string | null;
  routingRulesJson?: string | null;
  defaultAssigneeAgentId?: string | null;
  defaultPriority?: MnTaskPriority | null;
  isActive?: boolean | null;
}

// ---------------------------------------------------------------------------
// M13 — Deep Planning. Revisionable plan documents attached to a task.
//
// Mirrors the backend DTO in
// `packages/backend/server/src/plugins/manut/manut-task-plan.dto.ts`
// and the Prisma enum in `schema.prisma`. The decision discriminator
// (`MnTaskPlanDecision`) is the API contract for the decide mutation
// — the frontend ships the enum value as a GraphQL enum literal.
// ---------------------------------------------------------------------------

export type MnTaskPlanStatus =
  | 'DRAFT'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'SUPERSEDED';

export const MN_TASK_PLAN_STATUSES: readonly MnTaskPlanStatus[] = [
  'DRAFT',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'SUPERSEDED',
];

export type MnTaskPlanDecision = 'APPROVE' | 'REJECT';

/**
 * Append-only reviewer comment audit entry. The backend pushes one of
 * these onto `reviewerComments` per `decidePlan` call. Shape is
 * defensive — the JSONB column can technically store anything, so the
 * UI narrows at the render boundary.
 */
export interface MnTaskPlanReviewerComment {
  decision?: MnTaskPlanDecision;
  comment?: string | null;
  decidedAt?: string;
  reviewerUserId?: string | null;
  reviewerAgentId?: string | null;
}

export interface MnTaskPlanDto {
  id: string;
  taskId: string;
  revisionNumber: number;
  bodyMd: string;
  status: MnTaskPlanStatus;
  authorAgentId: string | null;
  authorUserId: string | null;
  /** Untyped at the contract boundary — the column is JSONB so the
   *  shape can grow without a frontend schema change. Cast to
   *  `MnTaskPlanReviewerComment[]` at the render site. */
  reviewerComments: unknown;
  createdAt: string;
}

export interface CreateMnTaskPlanInput {
  taskId: string;
  bodyMd: string;
}

export interface DecideMnTaskPlanInput {
  planId: string;
  decision: MnTaskPlanDecision;
  comment?: string | null;
}
