import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { MnAgentRole, PrismaClient } from '@prisma/client';

import type { UpdateMnAgentRoleInput } from './manut-agent-registry.dto';

/**
 * Canonical 5 operating roles from the Manut control plane spec
 * (docs/SUPERFLOW_CONTROL_PLANE.md §47-58). Order matches the release
 * pipeline — Release Captain owns the goal, Builder produces the
 * artifact, Verifier attaches evidence, Deployer runs the swap,
 * Historian records the outcome.
 *
 * The same five appear in scripts/manut-release-handover.mjs to drive
 * the GitHub Actions summary; the seed here puts them in the workspace
 * registry so operators can rename / repoint adapters without forking
 * the script. Slugs are stable identifiers used by automation and
 * MUST NOT be renamed.
 */
export interface AgentRoleSeed {
  slug: string;
  displayName: string;
  adapter: string;
  responsibility: string;
  escalation: string | null;
}

export const DEFAULT_AGENT_ROLE_SEEDS: ReadonlyArray<AgentRoleSeed> = [
  {
    slug: 'release-captain',
    displayName: 'Release Captain',
    adapter: 'GitHub Actions summary and docs/RELEASES',
    responsibility: 'Keep release facts, goal, and pending follow-up visible.',
    escalation: null,
  },
  {
    slug: 'builder',
    displayName: 'Builder',
    adapter: 'manut-build.yml or manut-release.yml',
    responsibility: 'Create a fresh linux/amd64 image from rebuilt bundles.',
    escalation: null,
  },
  {
    slug: 'verifier',
    displayName: 'Verifier',
    adapter: 'CI checks, bundle logs, prompt guards, and deploy smoke probes',
    responsibility: 'Attach evidence before code is considered safe to ship.',
    escalation: null,
  },
  {
    slug: 'deployer',
    displayName: 'Deployer',
    adapter: 'manut-autodeploy.yml, manut-deploy.yml, deploy.sh',
    responsibility:
      'Run sidecar validation before production swap and preserve rollback.',
    escalation: null,
  },
  {
    slug: 'historian',
    displayName: 'Historian',
    adapter: 'docs/HANDOVER.md, docs/CICD.md, release notes',
    responsibility:
      'Convert transient build context into durable project memory.',
    escalation: null,
  },
];

@Injectable()
export class MnAgentRegistryService {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Returns the workspace's registered roles, sorted by slug for stable
   * presentation. Empty array when seedDefaults has not run.
   */
  async listRoles(workspaceId: string): Promise<MnAgentRole[]> {
    return this.db.mnAgentRole.findMany({
      where: { workspaceId },
      orderBy: { slug: 'asc' },
    });
  }

  /**
   * Idempotent seed: inserts any of the 5 canonical roles that are
   * missing for this workspace. Existing rows are left untouched so
   * operator edits to displayName / adapter / escalation survive
   * subsequent calls (e.g. a workspace create hook re-running on
   * startup, or a later phase wiring trying to ensure the rows exist
   * before importing a handover).
   */
  async seedDefaults(workspaceId: string): Promise<void> {
    for (const seed of DEFAULT_AGENT_ROLE_SEEDS) {
      await this.db.mnAgentRole.upsert({
        where: {
          workspaceId_slug: { workspaceId, slug: seed.slug },
        },
        create: {
          id: randomUUID(),
          workspaceId,
          slug: seed.slug,
          displayName: seed.displayName,
          adapter: seed.adapter,
          responsibility: seed.responsibility,
          escalation: seed.escalation,
        },
        // Do not overwrite edits on subsequent seeds — only create-if-missing.
        update: {},
      });
    }
  }

  /**
   * Updates editable fields on a role. The slug is immutable — it is
   * the stable identifier external automation and migrations rely on.
   * Pass null in any field to clear it (only allowed for escalation).
   */
  async updateRole(
    workspaceId: string,
    slug: string,
    input: UpdateMnAgentRoleInput
  ): Promise<MnAgentRole> {
    if ((input as { slug?: string }).slug !== undefined) {
      throw new BadRequestException('slug is immutable');
    }

    const existing = await this.db.mnAgentRole.findFirst({
      where: { workspaceId, slug },
    });
    if (!existing) {
      throw new NotFoundException(`Agent role '${slug}' not found`);
    }

    const data: Record<string, unknown> = {};
    if (input.displayName !== undefined && input.displayName !== null) {
      data.displayName = input.displayName;
    }
    if (input.adapter !== undefined && input.adapter !== null) {
      data.adapter = input.adapter;
    }
    if (input.responsibility !== undefined && input.responsibility !== null) {
      data.responsibility = input.responsibility;
    }
    if (input.escalation !== undefined) {
      data.escalation = input.escalation;
    }

    return this.db.mnAgentRole.update({
      where: { id: existing.id },
      data,
    });
  }

  /**
   * Used by the (Phase 4) handover importer to stamp the most recent
   * successful CI run id onto a role. No-ops when the role does not
   * exist — the importer should not break because the registry was
   * never seeded for this workspace.
   */
  async markRoleRunSuccessful(
    workspaceId: string,
    slug: string,
    runId: string
  ): Promise<void> {
    const existing = await this.db.mnAgentRole.findFirst({
      where: { workspaceId, slug },
    });
    if (!existing) {
      return;
    }
    await this.db.mnAgentRole.update({
      where: { id: existing.id },
      data: {
        lastSuccessfulRunId: runId,
        lastSeenAt: new Date(),
      },
    });
  }
}
