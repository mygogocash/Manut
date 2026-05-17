import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { MnAgent } from '@prisma/client';
import {
  MnAgentAdapterType,
  MnAgentStatus,
  PrismaClient,
} from '@prisma/client';

import {
  CreateMnAgentSchema,
  type CreateMnAgentValues,
  UpdateMnAgentSchema,
  type UpdateMnAgentValues,
} from './manut-agent.dto';

/**
 * Hard ceiling on how deep we'll walk the `reportsTo` chain when looking
 * for cycles. Honest org-charts should never need more than 32; any chain
 * longer than that is almost certainly a malformed dataset and we bail
 * out rather than hang the request.
 *
 * Picked deliberately small — depth 32 already implies a 33-level
 * reporting tree, which is well past anything we'd ever see in practice.
 */
const MAX_REPORTS_TO_DEPTH = 32;

/**
 * CRUD for Manut agent identity (M1).
 *
 * Cross-cutting invariants enforced here (NOT in the resolver) so
 * direct callers (heartbeat consumer, future MCP bridge, tests) get
 * the same guarantees as GraphQL clients:
 *
 *  1. `projectId` must belong to the workspace passed by the caller.
 *  2. `roleId`, if supplied, must belong to the same workspace.
 *  3. `reportsToAgentId`, if supplied, must (a) belong to the same
 *     workspace, and (b) not introduce a cycle in the reporting tree.
 *  4. An agent in `TERMINATED` status cannot be resumed — terminal
 *     means terminal. Update calls that try to flip TERMINATED → any
 *     other status are rejected with `BadRequestException`.
 *
 * CLAUDE.md scars honored:
 *  - `@Injectable()` is present so TS emits `design:paramtypes` and
 *    NestJS DI can resolve `PrismaClient` (v1.12.0 production scar).
 *  - `PrismaClient` is a RUNTIME import, not `import type`, so the
 *    constructor parameter metadata reflects the real class
 *    (v1.12.0 production scar).
 *  - Row types like `MnAgent` ARE imported via `import type` — pure
 *    type usage is fine and keeps the runtime bundle smaller.
 */
@Injectable()
export class MnAgentService {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Create a new agent inside `workspaceId`. Caller is responsible
   * for permission checks; this method enforces data invariants.
   */
  async create(
    workspaceId: string,
    createdByUserId: string | null,
    input: CreateMnAgentValues
  ): Promise<MnAgent> {
    const values = CreateMnAgentSchema.parse(input);

    await this.assertProjectInWorkspace(workspaceId, values.projectId);

    if (values.roleId) {
      await this.assertRoleInWorkspace(workspaceId, values.roleId);
    }

    if (values.reportsToAgentId) {
      await this.assertReportsToInWorkspace(
        workspaceId,
        values.reportsToAgentId
      );
    }

    return this.db.mnAgent.create({
      data: {
        id: randomUUID(),
        workspaceId,
        projectId: values.projectId,
        roleId: values.roleId ?? null,
        name: values.name,
        adapterType:
          values.adapterType ?? MnAgentAdapterType.COPILOT_CHAT_SESSION,
        adapterConfig: (values.adapterConfig ?? {}) as object,
        runtimeConfig: (values.runtimeConfig ?? {}) as object,
        reportsToAgentId: values.reportsToAgentId ?? null,
        capabilities: values.capabilities ?? null,
        createdByUserId: createdByUserId ?? null,
      },
    });
  }

  /**
   * List agents in a workspace, newest first. Optional `projectId` filter
   * narrows to a single project (used by the project view).
   */
  async list(
    workspaceId: string,
    projectId?: string | null
  ): Promise<MnAgent[]> {
    return this.db.mnAgent.findMany({
      where: {
        workspaceId,
        ...(projectId ? { projectId } : {}),
      },
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  /**
   * Get a single agent by id, scoped to `workspaceId` so callers can't
   * dereference an id leaked from another workspace.
   *
   * Returns `null` (not throws) so callers can render an empty state.
   * Use `getOrThrow` when the caller treats absence as an error.
   */
  async get(workspaceId: string, agentId: string): Promise<MnAgent | null> {
    const row = await this.db.mnAgent.findUnique({ where: { id: agentId } });
    if (!row || row.workspaceId !== workspaceId) return null;
    return row;
  }

  /**
   * Same as `get`, but throws `NotFoundException` on miss. Used by
   * mutations where we need to fail loudly rather than silently no-op.
   */
  async getOrThrow(workspaceId: string, agentId: string): Promise<MnAgent> {
    const row = await this.get(workspaceId, agentId);
    if (!row) {
      throw new NotFoundException(`Agent '${agentId}' not found`);
    }
    return row;
  }

  /**
   * Patch editable fields on an agent. Enforces:
   *  - role / reportsTo cross-tenant fences (same workspace),
   *  - no cycle in the reportsTo chain (rejected before write),
   *  - TERMINATED is terminal — cannot be resumed via this method.
   *
   * Returns the freshly-read row, not the merged input, so the caller
   * always sees the canonical DB state including `updatedAt`.
   */
  async update(
    workspaceId: string,
    agentId: string,
    input: UpdateMnAgentValues
  ): Promise<MnAgent> {
    const values = UpdateMnAgentSchema.parse(input);
    const current = await this.getOrThrow(workspaceId, agentId);

    if (current.status === MnAgentStatus.TERMINATED) {
      // Once an agent is terminated, the only legal further mutation
      // is delete. Trying to flip status back to IDLE / RUNNING / etc.
      // is a contract violation — surface it loudly.
      if (
        values.status !== undefined &&
        values.status !== null &&
        values.status !== MnAgentStatus.TERMINATED
      ) {
        throw new BadRequestException(
          `Agent '${agentId}' is TERMINATED and cannot be resumed`
        );
      }
      // Any other update (name change, capability edit, etc.) is also
      // not meaningful for a terminated agent. Reject all updates on
      // terminated agents to keep the audit trail clean.
      throw new BadRequestException(
        `Agent '${agentId}' is TERMINATED; updates are not permitted`
      );
    }

    if (values.roleId !== undefined && values.roleId !== null) {
      await this.assertRoleInWorkspace(workspaceId, values.roleId);
    }

    if (
      values.reportsToAgentId !== undefined &&
      values.reportsToAgentId !== null
    ) {
      if (values.reportsToAgentId === agentId) {
        throw new BadRequestException('Agent cannot report to itself');
      }
      await this.assertReportsToInWorkspace(
        workspaceId,
        values.reportsToAgentId
      );
      await this.assertNoCycle(agentId, values.reportsToAgentId);
    }

    return this.db.mnAgent.update({
      where: { id: agentId },
      data: {
        ...(values.roleId !== undefined ? { roleId: values.roleId } : {}),
        ...(values.name !== undefined && values.name !== null
          ? { name: values.name }
          : {}),
        ...(values.adapterType !== undefined && values.adapterType !== null
          ? { adapterType: values.adapterType }
          : {}),
        ...(values.adapterConfig !== undefined && values.adapterConfig !== null
          ? { adapterConfig: values.adapterConfig as object }
          : {}),
        ...(values.runtimeConfig !== undefined && values.runtimeConfig !== null
          ? { runtimeConfig: values.runtimeConfig as object }
          : {}),
        ...(values.status !== undefined && values.status !== null
          ? { status: values.status }
          : {}),
        ...(values.reportsToAgentId !== undefined
          ? { reportsToAgentId: values.reportsToAgentId }
          : {}),
        ...(values.capabilities !== undefined
          ? { capabilities: values.capabilities }
          : {}),
      },
    });
  }

  /**
   * Hard delete. Cascades to api keys and heartbeat runs via the
   * Prisma `onDelete: Cascade` rules on those models.
   *
   * `AiSession.agentId` is `onDelete: SetNull` so chat-session history
   * survives agent deletion — sessions just lose their owning agent.
   */
  async delete(workspaceId: string, agentId: string): Promise<void> {
    // Verify ownership before delete so a caller can't burn an agent
    // in another workspace by guessing the id.
    await this.getOrThrow(workspaceId, agentId);
    await this.db.mnAgent.delete({ where: { id: agentId } });
  }

  // ---------------------------------------------------------------------------
  // Invariant helpers — exposed as private methods rather than free
  // functions so the test suite can patch the underlying `db` and
  // exercise them via the public surface.
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

  private async assertRoleInWorkspace(
    workspaceId: string,
    roleId: string
  ): Promise<void> {
    const role = await this.db.mnAgentRole.findUnique({
      where: { id: roleId },
    });
    if (!role) {
      throw new BadRequestException(`Role '${roleId}' not found`);
    }
    if (role.workspaceId !== workspaceId) {
      throw new BadRequestException(
        `Role '${roleId}' does not belong to this workspace`
      );
    }
  }

  private async assertReportsToInWorkspace(
    workspaceId: string,
    reportsToAgentId: string
  ): Promise<void> {
    const parent = await this.db.mnAgent.findUnique({
      where: { id: reportsToAgentId },
    });
    if (!parent) {
      throw new BadRequestException(
        `reportsToAgent '${reportsToAgentId}' not found`
      );
    }
    if (parent.workspaceId !== workspaceId) {
      throw new BadRequestException(
        `reportsToAgent '${reportsToAgentId}' does not belong to this workspace`
      );
    }
  }

  /**
   * Walk up the reporting chain from `proposedParentId`. If we ever
   * land on `agentId` before running out of parents (or hitting the
   * max-depth ceiling), the proposed edge would form a cycle.
   *
   * Linear in chain length; cheap in practice because reporting trees
   * are shallow and DB lookups are by primary key.
   */
  private async assertNoCycle(
    agentId: string,
    proposedParentId: string
  ): Promise<void> {
    let cursor: string | null = proposedParentId;
    for (let i = 0; i < MAX_REPORTS_TO_DEPTH; i++) {
      if (cursor === null) return;
      if (cursor === agentId) {
        throw new BadRequestException(
          `Setting reportsTo to '${proposedParentId}' would create a cycle`
        );
      }
      const parent: MnAgent | null = await this.db.mnAgent.findUnique({
        where: { id: cursor },
      });
      if (!parent) return;
      cursor = parent.reportsToAgentId;
    }
    throw new BadRequestException(
      `reportsTo chain exceeds ${MAX_REPORTS_TO_DEPTH} levels — refusing`
    );
  }
}
