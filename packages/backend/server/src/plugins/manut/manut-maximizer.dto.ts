import { Field, ID, ObjectType } from '@nestjs/graphql';

/**
 * M12 — MAXIMIZER MODE DTOs.
 *
 * Per CLAUDE.md §6 UndefinedTypeError trap (v1.7.0 + v1.10.2 scars):
 * every `@Field` declaration carries an explicit `() => Type`, even
 * non-nullable scalars. NestJS reflection cannot infer GraphQL types
 * from a TypeScript boolean alone if the property declarator has any
 * structural quirks; the explicit arrow form is the source of truth.
 */

// ---------------------------------------------------------------------------
// GraphQL output types
// ---------------------------------------------------------------------------

/**
 * Result of toggling an agent's maximizer mode. Carries the freshly
 * persisted state so the UI can flip its toggle without a follow-up
 * `mnAgent` query.
 */
@ObjectType('MnAgentMaximizerToggleResult')
export class MnAgentMaximizerToggleResultObjectType {
  @Field(() => ID)
  agentId!: string;

  @Field(() => Boolean)
  maximizerMode!: boolean;
}

// ---------------------------------------------------------------------------
// Plain (non-GraphQL) interfaces used by the service layer.
//
// The orchestrator policy types are deliberately kept off the GraphQL
// surface — they're internal to the dispatch path and would balloon the
// schema for no client-visible win. The Zod schemas below are the
// runtime guard for tool-call payloads that flow into the service.
// ---------------------------------------------------------------------------

/**
 * Shape of an MnAgent row as seen by the maximizer orchestrator. We do
 * not import the Prisma row type into this DTO module so the file stays
 * free of runtime Prisma client coupling — the service constructs values
 * of this shape when it queries.
 */
export interface MnMaximizerAgentRow {
  id: string;
  workspaceId: string;
  projectId: string;
  maximizerMode: boolean;
  /** Comma-separated capabilities (NULL when no capabilities declared). */
  capabilities: string | null;
  reportsToAgentId: string | null;
}

/**
 * One pending tool call that the orchestrator may auto-delegate, batch,
 * or gate. The fields here are the minimal context the policy needs;
 * the caller is expected to map back to its own internal shape.
 */
export interface MnMaximizerToolCall {
  /** Stable id of this call within the batch — used for de-duping. */
  callId: string;
  /** Name of the tool being invoked. */
  toolName: string;
  /**
   * Capability slug this call requires (e.g. "github:write",
   * "docs:edit"). Used by the auto-delegation pass to pick a
   * subordinate agent whose `capabilities` column lists this slug.
   */
  capability: string | null;
  /** Estimated cost of this call in cents (0 if unknown). */
  costCents: number;
}

/**
 * Decision the orchestrator returns per tool call. The caller dispatches
 * accordingly: `EXECUTE` runs the call locally on the requesting agent,
 * `DELEGATE` reassigns it to `delegateAgentId`, and `REQUIRE_APPROVAL`
 * stops the call until a human (or upstream agent) decides via the M3
 * approvals surface.
 */
export type MnMaximizerDecisionKind =
  | 'EXECUTE'
  | 'DELEGATE'
  | 'REQUIRE_APPROVAL';

export interface MnMaximizerDecision {
  callId: string;
  kind: MnMaximizerDecisionKind;
  /** Filled when `kind === 'DELEGATE'`. */
  delegateAgentId: string | null;
  /** Filled when `kind === 'REQUIRE_APPROVAL'`. */
  approvalReason: string | null;
  /**
   * Batch index assigned by the heartbeat scheduler — the first 10
   * calls land in batch 0, the next 10 in batch 1, etc. Callers route
   * each batch to a single heartbeat run.
   */
  batchIndex: number;
}

/**
 * Aggregated result of running the orchestrator over a list of calls.
 * The caller iterates `decisions` in order; the `batchCount` field is
 * a convenience for the scheduler.
 */
export interface MnMaximizerPlan {
  agentId: string;
  decisions: MnMaximizerDecision[];
  batchCount: number;
}
