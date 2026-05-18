import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  type MnAgent,
  MnApprovalStatus,
  MnApprovalType,
  type MnOrgChange,
  MnOrgChangeStatus,
  MnOrgChangeType,
  type MnRoutine,
  MnRoutineStatus,
  MnRoutineVisibility,
  PrismaClient,
} from '@prisma/client';

import {
  DecideMnOrgChangeSchema,
  type DecideMnOrgChangeValues,
  ProposeMnOrgChangeSchema,
  type ProposeMnOrgChangeValues,
} from './manut-org-change.dto';

const DEFAULT_LIST_LIMIT = 100;
const MAX_LIST_LIMIT = 500;

/**
 * Lifecycle rules:
 *
 *   PROPOSED --decide(APPROVED)----> APPROVED
 *   PROPOSED --decide(REJECTED)----> REJECTED  (terminal)
 *   APPROVED --apply()----> APPLIED
 *   APPLIED  --revert()----> REVERTED          (when reversible)
 *
 * `propose()` ALSO creates a sibling MnApproval row (type =
 * AGENT_ORG_CHANGE) so the existing inbox / SSE surface gates the
 * decision. `decide()` keeps the org-change row and its sibling
 * approval in lock-step (they share the same status semantics for
 * APPROVED / REJECTED).
 *
 * CLAUDE.md scars honored:
 *  - `@Injectable()` so TS emits `design:paramtypes` for NestJS DI.
 *  - `PrismaClient` is a RUNTIME import (NOT `import type`). Prisma
 *    enums (`MnApprovalType`, `MnOrgChangeStatus`, `MnRoutineStatus`,
 *    `MnRoutineVisibility`, `MnApprovalStatus`, `MnOrgChangeType`) are
 *    also runtime imports — they're used at runtime in switch / equality
 *    checks. Only row types (`MnOrgChange`, `MnAgent`, `MnRoutine`) use
 *    `import type` — pure-type usages, safe from the v1.12.0 trap.
 */
@Injectable()
export class MnOrgChangeService {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Create a new PROPOSED org-change AND its sibling MnApproval row
   * (type = AGENT_ORG_CHANGE). The approval `payload.orgChangeId`
   * links the two so the inbox can render a deep-link back to the
   * proposal.
   *
   * Both rows are written in a single transaction so a partial state
   * (org-change with no approval, or vice-versa) cannot exist on
   * either side of a crash.
   */
  async propose(
    workspaceId: string,
    input: ProposeMnOrgChangeValues
  ): Promise<MnOrgChange> {
    const values = ProposeMnOrgChangeSchema.parse(input);
    await this.assertProjectInWorkspace(workspaceId, values.projectId);

    if (values.proposedByAgentId) {
      await this.assertAgentInWorkspace(workspaceId, values.proposedByAgentId);
    }

    return this.db.$transaction(async tx => {
      const orgChangeId = randomUUID();
      const row = await tx.mnOrgChange.create({
        data: {
          id: orgChangeId,
          workspaceId,
          projectId: values.projectId,
          type: values.type,
          proposedByAgentId: values.proposedByAgentId ?? null,
          status: MnOrgChangeStatus.PROPOSED,
          payload: values.payload as object,
          rationale: values.rationale,
        },
      });
      await tx.mnApproval.create({
        data: {
          id: randomUUID(),
          workspaceId,
          projectId: values.projectId,
          type: MnApprovalType.AGENT_ORG_CHANGE,
          requestedByAgentId: values.proposedByAgentId ?? null,
          status: MnApprovalStatus.PENDING,
          payload: {
            orgChangeId,
            orgChangeType: values.type,
            rationale: values.rationale,
          },
        },
      });
      return row;
    });
  }

  /**
   * List org-change proposals for an inbox. Workspace-scoped; supports
   * project, status, type, and proposer-agent filters. Limit clamped
   * to `[1, 500]`; default 100. Ordered by `createdAt DESC`.
   */
  async list(
    workspaceId: string,
    filter: {
      projectId?: string | null;
      statuses?: MnOrgChangeStatus[] | null;
      types?: MnOrgChangeType[] | null;
      proposedByAgentId?: string | null;
      limit?: number | null;
    } = {}
  ): Promise<MnOrgChange[]> {
    const limit = Math.min(
      Math.max(filter.limit ?? DEFAULT_LIST_LIMIT, 1),
      MAX_LIST_LIMIT
    );
    return this.db.mnOrgChange.findMany({
      where: {
        workspaceId,
        ...(filter.projectId ? { projectId: filter.projectId } : {}),
        ...(filter.statuses && filter.statuses.length
          ? { status: { in: filter.statuses } }
          : {}),
        ...(filter.types && filter.types.length
          ? { type: { in: filter.types } }
          : {}),
        ...(filter.proposedByAgentId
          ? { proposedByAgentId: filter.proposedByAgentId }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }],
      take: limit,
    });
  }

  /**
   * Fetch a single proposal, scoped to `workspaceId`. Returns `null`
   * for an unknown id OR for an id that belongs to another workspace
   * (no info leak across workspaces — same shape as MnApproval.get).
   */
  async get(
    workspaceId: string,
    orgChangeId: string
  ): Promise<MnOrgChange | null> {
    const row = await this.db.mnOrgChange.findUnique({
      where: { id: orgChangeId },
    });
    if (!row || row.workspaceId !== workspaceId) return null;
    return row;
  }

  /**
   * Same as `get`, but throws `NotFoundException` on miss. Used by
   * mutations.
   */
  async getOrThrow(
    workspaceId: string,
    orgChangeId: string
  ): Promise<MnOrgChange> {
    const row = await this.get(workspaceId, orgChangeId);
    if (!row) {
      throw new NotFoundException(`Org change '${orgChangeId}' not found`);
    }
    return row;
  }

  /**
   * Decide a PROPOSED change. Only APPROVED / REJECTED are legal:
   *  - PROPOSED is the start state, never a write target.
   *  - APPLIED / REVERTED are reachable only via apply() / revert().
   *
   * Also flips the linked MnApproval to APPROVED / REJECTED so the
   * inbox stays consistent. The approval is matched via
   * `payload.orgChangeId` written by `propose()`.
   */
  async decide(
    workspaceId: string,
    orgChangeId: string,
    decidedByUserId: string,
    input: DecideMnOrgChangeValues
  ): Promise<MnOrgChange> {
    const values = DecideMnOrgChangeSchema.parse(input);
    if (
      values.status !== MnOrgChangeStatus.APPROVED &&
      values.status !== MnOrgChangeStatus.REJECTED
    ) {
      throw new BadRequestException(
        'Only APPROVED or REJECTED is a legal decide target — APPLIED ' +
          'and REVERTED are reachable only via apply() / revert().'
      );
    }
    const current = await this.getOrThrow(workspaceId, orgChangeId);
    if (current.status !== MnOrgChangeStatus.PROPOSED) {
      throw new BadRequestException(
        `Org change '${orgChangeId}' is '${current.status}', not PROPOSED — ` +
          'cannot decide.'
      );
    }

    return this.db.$transaction(async tx => {
      const updated = await tx.mnOrgChange.update({
        where: { id: orgChangeId },
        data: {
          status: values.status,
          decisionNote: values.decisionNote ?? null,
          decidedByUserId,
          decidedAt: new Date(),
        },
      });
      // Mirror the decision onto the sibling approval. Match the row
      // via JSON-field equality on `payload.orgChangeId`. We do this
      // with raw SQL via updateMany so we don't have to hold a
      // separate id link on the org-change row.
      await tx.mnApproval.updateMany({
        where: {
          workspaceId,
          type: MnApprovalType.AGENT_ORG_CHANGE,
          status: MnApprovalStatus.PENDING,
          payload: { path: ['orgChangeId'], equals: orgChangeId },
        },
        data: {
          status:
            values.status === MnOrgChangeStatus.APPROVED
              ? MnApprovalStatus.APPROVED
              : MnApprovalStatus.REJECTED,
          decisionNote: values.decisionNote ?? null,
          decidedByUserId,
          decidedAt: new Date(),
        },
      });
      return updated;
    });
  }

  /**
   * Execute the structural change. Requires the proposal to be in
   * APPROVED state. Mutates the underlying tables based on type +
   * payload, captures the prior state into `payload.priorState` (so
   * `revert()` can undo it), then transitions to APPLIED.
   *
   * Each kind has a small inline executor — they're short enough
   * that splitting them out into per-kind helper classes is more
   * cost than benefit. If the matrix grows past ~6 kinds, refactor.
   */
  async apply(workspaceId: string, orgChangeId: string): Promise<MnOrgChange> {
    const current = await this.getOrThrow(workspaceId, orgChangeId);
    if (current.status !== MnOrgChangeStatus.APPROVED) {
      throw new BadRequestException(
        `Org change '${orgChangeId}' is '${current.status}', not APPROVED — ` +
          'cannot apply.'
      );
    }
    const payload = (current.payload ?? {}) as Record<string, unknown>;

    return this.db.$transaction(async tx => {
      const nextPayload: Record<string, unknown> = { ...payload };
      switch (current.type) {
        case MnOrgChangeType.DELEGATION_CHANGE:
        case MnOrgChangeType.REPORTING_CHANGE: {
          const agentId = this.requireString(payload, 'agentId');
          const newReportsToAgentId = this.optionalString(
            payload,
            'newReportsToAgentId'
          );
          const agent = await this.fetchAgent(tx, workspaceId, agentId);
          nextPayload.priorState = {
            reportsToAgentId: agent.reportsToAgentId ?? null,
          };
          if (newReportsToAgentId) {
            await this.fetchAgent(tx, workspaceId, newReportsToAgentId);
          }
          await tx.mnAgent.update({
            where: { id: agentId },
            data: { reportsToAgentId: newReportsToAgentId ?? null },
          });
          break;
        }
        case MnOrgChangeType.NEW_ROUTINE: {
          const name = this.requireString(payload, 'name');
          const prompt = this.requireString(payload, 'prompt');
          const description = this.optionalString(payload, 'description');
          const cronSchedule = this.optionalString(payload, 'cronSchedule');
          const timezone = this.optionalString(payload, 'timezone');
          const ownerId = this.optionalString(payload, 'ownerId');
          if (!ownerId) {
            throw new BadRequestException(
              'NEW_ROUTINE payload requires `ownerId` (the operator who ' +
                'will own the routine after apply).'
            );
          }
          const routineId = randomUUID();
          const routine: MnRoutine = await tx.mnRoutine.create({
            data: {
              id: routineId,
              workspaceId,
              ownerId,
              visibility: MnRoutineVisibility.PERSONAL,
              name,
              description: description ?? null,
              prompt,
              cronSchedule: cronSchedule ?? null,
              timezone: timezone ?? null,
              status: MnRoutineStatus.ACTIVE,
            },
          });
          nextPayload.createdRoutineId = routine.id;
          nextPayload.priorState = { createdRoutineId: null };
          break;
        }
        case MnOrgChangeType.CAPABILITY_GRANT: {
          const agentId = this.requireString(payload, 'agentId');
          const capabilities = payload.capabilities;
          if (
            !Array.isArray(capabilities) ||
            !capabilities.every(c => typeof c === 'string')
          ) {
            throw new BadRequestException(
              'CAPABILITY_GRANT payload requires `capabilities: string[]`.'
            );
          }
          const agent = await this.fetchAgent(tx, workspaceId, agentId);
          nextPayload.priorState = { capabilities: agent.capabilities ?? null };
          const next = capabilities.join(',');
          await tx.mnAgent.update({
            where: { id: agentId },
            data: { capabilities: next },
          });
          break;
        }
        case MnOrgChangeType.ROLE_ADJUSTMENT:
        case MnOrgChangeType.AGENT_HIRE_PROPOSAL: {
          // These two kinds are advisory-only at M15 — operator must
          // act on them out-of-band (edit role via existing Roles
          // subtab, hire agent via Agents subtab). Marking APPLIED
          // closes the loop; revert is a no-op.
          nextPayload.priorState = { advisory: true };
          break;
        }
        default: {
          throw new BadRequestException(
            `Unknown MnOrgChangeType: ${String(current.type)}`
          );
        }
      }

      return tx.mnOrgChange.update({
        where: { id: orgChangeId },
        data: {
          status: MnOrgChangeStatus.APPLIED,
          payload: nextPayload as object,
          appliedAt: new Date(),
        },
      });
    });
  }

  /**
   * Reverse an applied change when possible. Reads `payload.priorState`
   * (written by `apply()`) and restores the underlying tables. For
   * advisory-only kinds (ROLE_ADJUSTMENT, AGENT_HIRE_PROPOSAL) the
   * underlying state was never touched, so revert is a no-op transition
   * (APPLIED -> REVERTED).
   */
  async revert(workspaceId: string, orgChangeId: string): Promise<MnOrgChange> {
    const current = await this.getOrThrow(workspaceId, orgChangeId);
    if (current.status !== MnOrgChangeStatus.APPLIED) {
      throw new BadRequestException(
        `Org change '${orgChangeId}' is '${current.status}', not APPLIED — ` +
          'cannot revert.'
      );
    }
    const payload = (current.payload ?? {}) as Record<string, unknown>;
    const prior = (payload.priorState ?? null) as Record<
      string,
      unknown
    > | null;
    if (!prior) {
      throw new BadRequestException(
        `Org change '${orgChangeId}' has no priorState — revert impossible.`
      );
    }

    return this.db.$transaction(async tx => {
      switch (current.type) {
        case MnOrgChangeType.DELEGATION_CHANGE:
        case MnOrgChangeType.REPORTING_CHANGE: {
          const agentId = this.requireString(payload, 'agentId');
          const reportsToAgentId = this.optionalString(
            prior,
            'reportsToAgentId'
          );
          await tx.mnAgent.update({
            where: { id: agentId },
            data: { reportsToAgentId: reportsToAgentId ?? null },
          });
          break;
        }
        case MnOrgChangeType.NEW_ROUTINE: {
          const createdRoutineId = this.optionalString(
            payload,
            'createdRoutineId'
          );
          if (createdRoutineId) {
            await tx.mnRoutine.deleteMany({
              where: { id: createdRoutineId, workspaceId },
            });
          }
          break;
        }
        case MnOrgChangeType.CAPABILITY_GRANT: {
          const agentId = this.requireString(payload, 'agentId');
          const capabilities = this.optionalString(prior, 'capabilities');
          await tx.mnAgent.update({
            where: { id: agentId },
            data: { capabilities: capabilities ?? null },
          });
          break;
        }
        case MnOrgChangeType.ROLE_ADJUSTMENT:
        case MnOrgChangeType.AGENT_HIRE_PROPOSAL: {
          // Advisory only — no state to restore.
          break;
        }
        default: {
          throw new BadRequestException(
            `Unknown MnOrgChangeType: ${String(current.type)}`
          );
        }
      }
      return tx.mnOrgChange.update({
        where: { id: orgChangeId },
        data: { status: MnOrgChangeStatus.REVERTED },
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Invariant helpers + payload accessors.
  // ---------------------------------------------------------------------------

  private async assertProjectInWorkspace(
    workspaceId: string,
    projectId: string
  ): Promise<void> {
    const project = await this.db.mnProject.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      throw new BadRequestException(`Project '${projectId}' not found`);
    }
    if (project.workspaceId !== workspaceId) {
      throw new BadRequestException(
        `Project '${projectId}' does not belong to this workspace`
      );
    }
  }

  private async assertAgentInWorkspace(
    workspaceId: string,
    agentId: string
  ): Promise<void> {
    const agent = await this.db.mnAgent.findUnique({
      where: { id: agentId },
    });
    if (!agent) {
      throw new BadRequestException(`Agent '${agentId}' not found`);
    }
    if (agent.workspaceId !== workspaceId) {
      throw new BadRequestException(
        `Agent '${agentId}' does not belong to this workspace`
      );
    }
  }

  /**
   * Tx-scoped agent fetch used by apply()/revert(). Throws on
   * cross-workspace or missing rows so partial application can't
   * happen.
   */
  private async fetchAgent(
    tx: {
      mnAgent: {
        findUnique: (args: {
          where: { id: string };
        }) => Promise<MnAgent | null>;
      };
    },
    workspaceId: string,
    agentId: string
  ): Promise<MnAgent> {
    const agent = await tx.mnAgent.findUnique({ where: { id: agentId } });
    if (!agent) {
      throw new BadRequestException(`Agent '${agentId}' not found`);
    }
    if (agent.workspaceId !== workspaceId) {
      throw new BadRequestException(
        `Agent '${agentId}' does not belong to this workspace`
      );
    }
    return agent;
  }

  private requireString(obj: Record<string, unknown>, key: string): string {
    const value = obj[key];
    if (typeof value !== 'string' || value.length === 0) {
      throw new BadRequestException(
        `Org change payload missing required string field '${key}'`
      );
    }
    return value;
  }

  private optionalString(
    obj: Record<string, unknown>,
    key: string
  ): string | null {
    const value = obj[key];
    if (value === undefined || value === null) return null;
    if (typeof value !== 'string') {
      throw new BadRequestException(
        `Org change payload field '${key}' must be a string or null`
      );
    }
    return value;
  }
}
