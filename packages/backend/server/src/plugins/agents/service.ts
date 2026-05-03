import { Injectable } from '@nestjs/common';
import { Agent as AgentRow, PrismaClient } from '@prisma/client';

import { ActionForbidden, NotFound } from '../../base';
import { Models, WorkspaceRole } from '../../models';
import { AccessController } from '../../core/permission';
import {
  type AgentLink,
  CreateAgentInput,
  MAX_SUB_AGENT_DEPTH,
  UpdateAgentInput,
} from './types';

/**
 * Lightweight materialized view of an agent row with the JSON `links` column
 * decoded back into typed objects. The Prisma row stores it as `Json`.
 */
export interface AgentRecord
  extends Omit<AgentRow, 'links' | 'parentAgentId' | 'avatar'> {
  parentAgentId: string | null;
  links: AgentLink[];
  avatar: Record<string, unknown>;
}

function parseAvatar(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function rowToRecord(row: AgentRow): AgentRecord {
  return {
    ...row,
    parentAgentId: row.parentAgentId,
    links: parseLinks(row.links),
    avatar: parseAvatar(row.avatar),
  };
}

function parseLinks(value: unknown): AgentLink[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(item => {
    if (
      item &&
      typeof item === 'object' &&
      'url' in (item as Record<string, unknown>) &&
      typeof (item as Record<string, unknown>).url === 'string'
    ) {
      const obj = item as Record<string, unknown>;
      const link: AgentLink = { url: obj.url as string };
      if (typeof obj.label === 'string') link.label = obj.label;
      return [link];
    }
    return [];
  });
}

@Injectable()
export class AgentsService {
  constructor(
    private readonly db: PrismaClient,
    private readonly ac: AccessController,
    private readonly models: Models
  ) {}

  /**
   * Assert the user can read the workspace. Any member can list/read agents.
   */
  private async assertCanRead(userId: string, workspaceId: string) {
    await this.ac.user(userId).workspace(workspaceId).assert('Workspace.Read');
  }

  /**
   * Assert the user can write the agent: owner of the agent OR workspace owner.
   * Workspace.Read is required as a baseline (otherwise we'd leak existence).
   */
  private async assertCanWrite(userId: string, agent: AgentRow) {
    await this.ac
      .user(userId)
      .workspace(agent.workspaceId)
      .assert('Workspace.Read');

    if (agent.ownerId === userId) return;

    const role = await this.models.workspaceUser.getActive(
      agent.workspaceId,
      userId
    );
    if (role?.type === WorkspaceRole.Owner) return;

    throw new ActionForbidden();
  }

  /**
   * Walk up the parent chain and return its depth (0 = root). Used to refuse
   * creating a child that would exceed MAX_SUB_AGENT_DEPTH.
   */
  private async parentDepth(parentAgentId: string): Promise<number> {
    let depth = 0;
    let current: string | null = parentAgentId;
    // Hard cap iterations defensively even if data is malformed.
    while (current && depth <= MAX_SUB_AGENT_DEPTH + 1) {
      const row: { parentAgentId: string | null } | null =
        await this.db.agent.findUnique({
          where: { id: current },
          select: { parentAgentId: true },
        });
      if (!row) break;
      depth += 1;
      current = row.parentAgentId;
    }
    return depth;
  }

  async list(
    userId: string,
    workspaceId: string,
    parentAgentId?: string | null
  ): Promise<AgentRecord[]> {
    await this.assertCanRead(userId, workspaceId);
    const rows = await this.db.agent.findMany({
      where: {
        workspaceId,
        // Pass `null` to fetch only top-level agents; omit to fetch all.
        ...(parentAgentId === undefined ? {} : { parentAgentId }),
      },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(rowToRecord);
  }

  async get(userId: string, id: string): Promise<AgentRecord | null> {
    const row = await this.db.agent.findUnique({ where: { id } });
    if (!row) return null;
    await this.assertCanRead(userId, row.workspaceId);
    return rowToRecord(row);
  }

  async create(
    userId: string,
    input: CreateAgentInput
  ): Promise<AgentRecord> {
    await this.ac
      .user(userId)
      .workspace(input.workspaceId)
      .assert('Workspace.Read');

    if (input.parentAgentId) {
      const parent = await this.db.agent.findUnique({
        where: { id: input.parentAgentId },
      });
      if (!parent) {
        throw new NotFound();
      }
      if (parent.workspaceId !== input.workspaceId) {
        // Sub-agents must live in the same workspace as their parent.
        throw new ActionForbidden();
      }
      const depth = await this.parentDepth(input.parentAgentId);
      if (depth >= MAX_SUB_AGENT_DEPTH) {
        throw new ActionForbidden();
      }
    }

    const row = await this.db.agent.create({
      data: {
        workspaceId: input.workspaceId,
        ownerId: userId,
        parentAgentId: input.parentAgentId ?? null,
        name: input.name,
        description: input.description ?? '',
        instructions: input.instructions ?? '',
        // Avatar is free-form JSON. Default to empty object — the renderer
        // falls back to defaults for missing keys.
        avatar: (input.avatar ?? {}) as any,
      },
    });
    return rowToRecord(row);
  }

  async update(
    userId: string,
    id: string,
    input: UpdateAgentInput
  ): Promise<AgentRecord> {
    const existing = await this.db.agent.findUnique({ where: { id } });
    if (!existing) throw new NotFound();
    await this.assertCanWrite(userId, existing);

    const row = await this.db.agent.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && {
          description: input.description,
        }),
        ...(input.instructions !== undefined && {
          instructions: input.instructions,
        }),
        ...(input.skills !== undefined && { skills: input.skills }),
        ...(input.links !== undefined && {
          // Prisma's Json column accepts plain arrays; map to a clean
          // shape so we don't store extra fields the GraphQL type doesn't
          // expose (the frontend may attach a transient `id` for keying).
          links: input.links.map(l => ({
            url: l.url,
            ...(l.label ? { label: l.label } : {}),
          })),
        }),
        ...(input.files !== undefined && { files: input.files }),
        // Avatar is replaced wholesale when provided. Server doesn't validate
        // the shape — the avataaars renderer ignores unknown keys.
        ...(input.avatar !== undefined && {
          avatar: input.avatar as any,
        }),
      },
    });
    return rowToRecord(row);
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const existing = await this.db.agent.findUnique({ where: { id } });
    if (!existing) return false;
    await this.assertCanWrite(userId, existing);
    await this.db.agent.delete({ where: { id } });
    return true;
  }

  async addSkill(
    userId: string,
    id: string,
    skill: string
  ): Promise<AgentRecord> {
    const existing = await this.db.agent.findUnique({ where: { id } });
    if (!existing) throw new NotFound();
    await this.assertCanWrite(userId, existing);
    if (existing.skills.includes(skill)) {
      return rowToRecord(existing);
    }
    const row = await this.db.agent.update({
      where: { id },
      data: { skills: { push: skill } },
    });
    return rowToRecord(row);
  }

  async removeSkill(
    userId: string,
    id: string,
    skill: string
  ): Promise<AgentRecord> {
    const existing = await this.db.agent.findUnique({ where: { id } });
    if (!existing) throw new NotFound();
    await this.assertCanWrite(userId, existing);
    const row = await this.db.agent.update({
      where: { id },
      data: { skills: existing.skills.filter(s => s !== skill) },
    });
    return rowToRecord(row);
  }

  async addLink(
    userId: string,
    id: string,
    url: string,
    label?: string
  ): Promise<AgentRecord> {
    const existing = await this.db.agent.findUnique({ where: { id } });
    if (!existing) throw new NotFound();
    await this.assertCanWrite(userId, existing);
    const links = parseLinks(existing.links);
    if (links.some(l => l.url === url)) {
      return rowToRecord(existing);
    }
    const next: AgentLink = label === undefined ? { url } : { url, label };
    const row = await this.db.agent.update({
      where: { id },
      data: { links: [...links, next] as any },
    });
    return rowToRecord(row);
  }

  async removeLink(
    userId: string,
    id: string,
    url: string
  ): Promise<AgentRecord> {
    const existing = await this.db.agent.findUnique({ where: { id } });
    if (!existing) throw new NotFound();
    await this.assertCanWrite(userId, existing);
    const links = parseLinks(existing.links).filter(l => l.url !== url);
    const row = await this.db.agent.update({
      where: { id },
      data: { links: links as any },
    });
    return rowToRecord(row);
  }

  async addFile(
    userId: string,
    id: string,
    fileId: string
  ): Promise<AgentRecord> {
    const existing = await this.db.agent.findUnique({ where: { id } });
    if (!existing) throw new NotFound();
    await this.assertCanWrite(userId, existing);
    if (existing.files.includes(fileId)) return rowToRecord(existing);
    const row = await this.db.agent.update({
      where: { id },
      data: { files: { push: fileId } },
    });
    return rowToRecord(row);
  }

  async removeFile(
    userId: string,
    id: string,
    fileId: string
  ): Promise<AgentRecord> {
    const existing = await this.db.agent.findUnique({ where: { id } });
    if (!existing) throw new NotFound();
    await this.assertCanWrite(userId, existing);
    const row = await this.db.agent.update({
      where: { id },
      data: { files: existing.files.filter(f => f !== fileId) },
    });
    return rowToRecord(row);
  }
}
