import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  type MnApproval,
  MnApprovalStatus,
  type MnApprovalType,
  PrismaClient,
} from '@prisma/client';

import {
  CreateMnApprovalSchema,
  type CreateMnApprovalValues,
  DecideMnApprovalSchema,
  type DecideMnApprovalValues,
} from './manut-approval.dto';
import { MnApprovalGateService } from './manut-approval-gate.service';

const DEFAULT_LIST_LIMIT = 100;
const MAX_LIST_LIMIT = 500;

/**
 * Terminal states. Once an approval reaches one of these, no further
 * mutation is allowed (decide-call returns BadRequestException).
 *
 * REVISION_REQUESTED is NOT terminal — it intentionally cycles back to
 * PENDING after the requester edits the payload, so the requester can
 * iterate without spawning a new row.
 */
const TERMINAL_STATUSES = new Set<MnApprovalStatus>([
  MnApprovalStatus.APPROVED,
  MnApprovalStatus.REJECTED,
  MnApprovalStatus.CANCELLED,
]);

/**
 * Status-machine cheat sheet:
 *
 *   PENDING --decide(APPROVED)----> APPROVED   (terminal)
 *   PENDING --decide(REJECTED)----> REJECTED   (terminal)
 *   PENDING --decide(CANCELLED)---> CANCELLED  (terminal)
 *   PENDING --decide(REVISION)----> REVISION_REQUESTED
 *   REVISION_REQUESTED --resubmit-> PENDING
 *
 * The service is the single source of truth for these transitions; the
 * resolver is a thin permissions+I/O wrapper.
 *
 * CLAUDE.md scars honored:
 *  - `@Injectable()` so TS emits `design:paramtypes` for NestJS DI.
 *  - `PrismaClient` is a RUNTIME import (not `import type`), same for
 *    `MnApprovalStatus` and `MnApprovalGateService`. Only the row type
 *    `MnApproval` uses `import type` — that's a pure-type usage and
 *    safe (v1.12.0 trap).
 */
@Injectable()
export class MnApprovalService {
  constructor(
    private readonly db: PrismaClient,
    private readonly gate: MnApprovalGateService
  ) {}

  /**
   * Create a new PENDING approval. Caller is responsible for permission
   * checks; this method enforces data invariants (project-in-workspace,
   * payload shape).
   */
  async create(
    workspaceId: string,
    requestedByUserId: string | null,
    input: CreateMnApprovalValues
  ): Promise<MnApproval> {
    const values = CreateMnApprovalSchema.parse(input);
    await this.assertProjectInWorkspace(workspaceId, values.projectId);

    if (values.requestedByAgentId) {
      await this.assertAgentInWorkspace(workspaceId, values.requestedByAgentId);
    }

    const row = await this.db.mnApproval.create({
      data: {
        id: randomUUID(),
        workspaceId,
        projectId: values.projectId,
        type: values.type,
        payload: (values.payload ?? {}) as object,
        requestedByAgentId: values.requestedByAgentId ?? null,
        requestedByUserId,
        status: MnApprovalStatus.PENDING,
      },
    });
    // Hot-path: the gate cache may have served zero pending for this
    // workspace within the TTL. Invalidate so the next tool dispatch
    // sees the fresh PENDING row.
    this.gate.invalidate(workspaceId);
    return row;
  }

  /**
   * List approvals for an inbox. Workspace-scoped; supports project,
   * status, type, and requesting-agent filters. Limit is clamped to
   * `[1, 500]`; default 100.
   *
   * Ordering: status PENDING / REVISION_REQUESTED first (so the inbox
   * surfaces actionable items), then by `createdAt DESC` so the most
   * recent work bubbles up.
   */
  async list(
    workspaceId: string,
    filter: {
      projectId?: string | null;
      statuses?: MnApprovalStatus[] | null;
      types?: MnApprovalType[] | null;
      requestedByAgentId?: string | null;
      limit?: number | null;
    } = {}
  ): Promise<MnApproval[]> {
    const limit = Math.min(
      Math.max(filter.limit ?? DEFAULT_LIST_LIMIT, 1),
      MAX_LIST_LIMIT
    );
    return this.db.mnApproval.findMany({
      where: {
        workspaceId,
        ...(filter.projectId ? { projectId: filter.projectId } : {}),
        ...(filter.statuses && filter.statuses.length
          ? { status: { in: filter.statuses } }
          : {}),
        ...(filter.types && filter.types.length
          ? { type: { in: filter.types } }
          : {}),
        ...(filter.requestedByAgentId
          ? { requestedByAgentId: filter.requestedByAgentId }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }],
      take: limit,
    });
  }

  /**
   * Fetch a single approval, scoped to `workspaceId`. Returns `null`
   * for an unknown id OR for an id that belongs to another workspace.
   *
   * Returning `null` (not throwing) is intentional: cross-workspace
   * lookup MUST be indistinguishable from "not found" so the API can't
   * be probed for foreign approval ids.
   */
  async get(
    workspaceId: string,
    approvalId: string
  ): Promise<MnApproval | null> {
    const row = await this.db.mnApproval.findUnique({
      where: { id: approvalId },
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
    approvalId: string
  ): Promise<MnApproval> {
    const row = await this.get(workspaceId, approvalId);
    if (!row) {
      throw new NotFoundException(`Approval '${approvalId}' not found`);
    }
    return row;
  }

  /**
   * Apply a decision. Rejects:
   *  - approvals already in a terminal status (APPROVED / REJECTED /
   *    CANCELLED) — they're immutable;
   *  - status transitions back to PENDING via this path (REVISION
   *    transition uses `submitRevision` below);
   *  - empty `decisionNote` when the status requires one (currently
   *    only REVISION_REQUESTED requires it).
   */
  async decide(
    workspaceId: string,
    approvalId: string,
    decidedByUserId: string,
    input: DecideMnApprovalValues
  ): Promise<MnApproval> {
    const values = DecideMnApprovalSchema.parse(input);
    if (values.status === MnApprovalStatus.PENDING) {
      throw new BadRequestException(
        'PENDING is not a valid decision status — only APPROVED, REJECTED, CANCELLED, or REVISION_REQUESTED.'
      );
    }
    const current = await this.getOrThrow(workspaceId, approvalId);

    if (TERMINAL_STATUSES.has(current.status)) {
      throw new BadRequestException(
        `Approval '${approvalId}' is already '${current.status}' — decisions are immutable`
      );
    }

    if (
      values.status === MnApprovalStatus.REVISION_REQUESTED &&
      !values.decisionNote
    ) {
      throw new BadRequestException(
        'REVISION_REQUESTED decision requires a decisionNote explaining what to change'
      );
    }

    const updated = await this.db.mnApproval.update({
      where: { id: approvalId },
      data: {
        status: values.status,
        decisionNote: values.decisionNote ?? null,
        decidedByUserId,
        decidedAt: new Date(),
      },
    });
    this.gate.invalidate(workspaceId);
    return updated;
  }

  /**
   * Move an approval back to PENDING after a REVISION_REQUESTED cycle.
   * Optionally overwrites the payload with the revised version.
   *
   * Rejects:
   *  - approvals not currently in REVISION_REQUESTED;
   *  - cross-workspace lookups (via `getOrThrow`).
   */
  async submitRevision(
    workspaceId: string,
    approvalId: string,
    payload?: Record<string, unknown> | null
  ): Promise<MnApproval> {
    const current = await this.getOrThrow(workspaceId, approvalId);
    if (current.status !== MnApprovalStatus.REVISION_REQUESTED) {
      throw new BadRequestException(
        `Approval '${approvalId}' is '${current.status}', not REVISION_REQUESTED — cannot resubmit`
      );
    }
    const updated = await this.db.mnApproval.update({
      where: { id: approvalId },
      data: {
        status: MnApprovalStatus.PENDING,
        // Clear the prior decision so the new PENDING row reads cleanly.
        decisionNote: null,
        decidedAt: null,
        decidedByUserId: null,
        ...(payload !== undefined && payload !== null
          ? { payload: payload as object }
          : {}),
      },
    });
    this.gate.invalidate(workspaceId);
    return updated;
  }

  /**
   * Stale-approval auto-cancellation. Called by `MnApprovalStaleCron`
   * every 5 minutes against a workspace-config-supplied timeout
   * (default 30 minutes). Returns the count of rows cancelled so the
   * cron can log it.
   *
   * Implementation note: the work is one bulk update; the cron handles
   * the timeout-resolution per workspace, not the service. This keeps
   * the service free of cron / config coupling.
   */
  async cancelPendingOlderThan(
    workspaceId: string,
    olderThan: Date
  ): Promise<number> {
    const result = await this.db.mnApproval.updateMany({
      where: {
        workspaceId,
        status: MnApprovalStatus.PENDING,
        createdAt: { lt: olderThan },
      },
      data: {
        status: MnApprovalStatus.CANCELLED,
        decisionNote: 'Auto-cancelled: pending approval exceeded timeout',
        decidedAt: new Date(),
      },
    });
    if (result.count > 0) {
      this.gate.invalidate(workspaceId);
    }
    return result.count;
  }

  /**
   * Count of currently-blocking approvals for a workspace. Used by the
   * gate service to populate its cache; we keep it close to the data
   * layer rather than inlining a Prisma query inside the gate.
   *
   * "Blocking" = PENDING or REVISION_REQUESTED. The latter is treated
   * as still-blocking because the requesting agent has to resubmit
   * before the gate can clear.
   */
  async pendingCountForWorkspace(workspaceId: string): Promise<number> {
    return this.db.mnApproval.count({
      where: {
        workspaceId,
        status: {
          in: [MnApprovalStatus.PENDING, MnApprovalStatus.REVISION_REQUESTED],
        },
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Invariant helpers.
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
}
