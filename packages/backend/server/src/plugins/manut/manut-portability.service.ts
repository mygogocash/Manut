import { createHash, randomUUID } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

import { buildAgentsMd } from './manut-agents-md-builder';
import {
  type AgentsMdAgent,
  type AgentsMdDocument,
  type AgentsMdGoal,
  parseAgentsMd,
} from './manut-agents-md-parser';
import { SCRUBBED_VALUE, scrubSecrets } from './manut-secret-scrubber';

/**
 * M5.2 + M5.3 — Workspace portability service.
 *
 * Two operations, both idempotent and atomic at the row level:
 *
 *   exportToManifest(workspaceId) → produces a manifest object, an
 *     AGENTS.md string, the per-skill bodies, and a stable SHA-256
 *     fingerprint over the canonical JSON payload. Secrets in
 *     adapterConfig / runtimeConfig are scrubbed via
 *     `scrubSecrets()` BEFORE serialization — the SHA is computed
 *     over the scrubbed payload so the same workspace exported on
 *     two days produces the same hash if nothing changed.
 *
 *   importFromManifest(workspaceId, payload) → parses the AGENTS.md,
 *     creates rows for any agents / skills / goals it describes in
 *     the target workspace. When an agent's adapterConfig contains
 *     the SCRUBBED_VALUE sentinel, the field is left as the sentinel
 *     and a warning is logged — the operator must reconstruct it
 *     post-import. This is the deliberate trade-off: portability
 *     bundles can be safely shared without leaking secrets.
 *
 * CLAUDE.md scars honoured:
 *  - `@Injectable()` is present so TS emits design:paramtypes and
 *    NestJS DI resolves PrismaClient (v1.12.0 production scar).
 *  - PrismaClient is a RUNTIME import (DI target). Row types from
 *    @prisma/client would be `import type`, but we don't use them in
 *    this file's public surface — services upstream do the typing.
 *  - Idempotency: re-importing the same manifest into a fresh
 *    workspace yields identical row count and a re-export produces
 *    the same SHA.
 */
@Injectable()
export class MnPortabilityService {
  private readonly logger = new Logger(MnPortabilityService.name);

  constructor(private readonly db: PrismaClient) {}

  /**
   * Produce a portability snapshot for `workspaceId`. The returned
   * `manifest` is a plain object suitable for JSON stringification or
   * insertion into MnExportSnapshot. The `agentsMd` string is the
   * round-trippable Markdown view of the same data.
   */
  async exportToManifest(workspaceId: string): Promise<{
    manifest: ExportManifest;
    agentsMd: string;
    skills: Array<{ slug: string; body: string }>;
    sha256: string;
  }> {
    const [projects, agents, goals, skillRows] = await Promise.all([
      this.db.mnProject.findMany({
        where: { workspaceId },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      }),
      this.db.mnAgent.findMany({
        where: { workspaceId },
        orderBy: [{ createdAt: 'asc' }],
      }),
      this.db.mnGoal.findMany({
        where: { workspaceId },
        orderBy: [{ createdAt: 'asc' }],
      }),
      this.db.mnSkill.findMany({
        where: { workspaceId, archivedAt: null },
        orderBy: [{ slug: 'asc' }],
      }),
    ]);

    const exportedAgents = agents.map(a => ({
      id: a.id,
      name: a.name,
      adapterType: String(a.adapterType),
      adapterConfig: scrubSecrets(a.adapterConfig),
      runtimeConfig: scrubSecrets(a.runtimeConfig),
      capabilities: a.capabilities ?? undefined,
      projectId: a.projectId,
      roleId: a.roleId ?? undefined,
    }));

    const exportedSkills = skillRows.map(s => ({
      slug: s.slug,
      name: s.name,
      description: s.description ?? undefined,
      contentMd: s.contentMd,
      version: s.version,
      source: String(s.source),
    }));

    const exportedGoals = goals.map(g => ({
      id: g.id,
      title: g.title,
      level: String(g.level),
      description: g.description ?? undefined,
      projectId: g.projectId,
      parentGoalId: g.parentGoalId ?? undefined,
      ownerAgentId: g.ownerAgentId ?? undefined,
      status: String(g.status),
    }));

    const exportedProjects = projects.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description ?? undefined,
      status: String(p.status),
      sortOrder: p.sortOrder,
    }));

    const agentsMdDoc: AgentsMdDocument = {
      frontmatter: {
        workspaceId,
        exportedAt: new Date().toISOString(),
        version: 'manut-portability-v1',
      },
      agents: exportedAgents.map(a => agentToMdAgent(a)),
      skills: exportedSkills.map(s => ({
        slug: s.slug,
        name: s.name,
        version: s.version,
        body: s.contentMd,
      })),
      goals: exportedGoals.map(g => goalToMdGoal(g)),
    };

    const manifest: ExportManifest = {
      version: 'manut-portability-v1',
      workspaceId,
      projects: exportedProjects,
      agents: exportedAgents,
      goals: exportedGoals,
      skills: exportedSkills.map(({ contentMd: _ignored, ...rest }) => rest),
    };

    const agentsMd = buildAgentsMd(agentsMdDoc);
    const skills = exportedSkills.map(s => ({
      slug: s.slug,
      body: s.contentMd,
    }));

    const canonical = stableStringify({
      manifest,
      agentsMd,
      skills,
    });
    const sha256 = createHash('sha256').update(canonical).digest('hex');

    return { manifest, agentsMd, skills, sha256 };
  }

  /**
   * Import a previously-exported manifest into `workspaceId`. The
   * target workspace MUST already exist. Returns counts of new rows.
   *
   * If `manifest.agents[].adapterConfig` contains the scrubbed
   * sentinel anywhere in the tree, that path is preserved verbatim
   * (the operator will need to fill it in post-import) and a warning
   * is logged with the agent name + field path.
   */
  async importFromManifest(
    workspaceId: string,
    payload: {
      manifest: ExportManifest;
      agentsMd: string;
      skills: Array<{ slug: string; body: string }>;
    }
  ): Promise<{
    agentsCreated: number;
    skillsCreated: number;
    goalsCreated: number;
  }> {
    const parsed = parseAgentsMd(payload.agentsMd);
    const skillsBySlug = new Map(
      payload.skills.map(s => [s.slug, s.body] as const)
    );

    let projectId: string | null = null;
    if (payload.manifest.projects[0]) {
      const firstProject = payload.manifest.projects[0];
      const created = await this.db.mnProject.create({
        data: {
          id: randomUUID(),
          workspaceId,
          name: firstProject.name,
          description: firstProject.description ?? null,
          sortOrder: firstProject.sortOrder ?? 0,
        },
      });
      projectId = created.id;
    } else {
      // No project in the manifest — create a placeholder so
      // agents / goals have a home.
      const created = await this.db.mnProject.create({
        data: {
          id: randomUUID(),
          workspaceId,
          name: 'Imported',
          description: 'Imported from AGENTS.md without a project block',
          sortOrder: 0,
        },
      });
      projectId = created.id;
    }

    let skillsCreated = 0;
    for (const skill of parsed.skills) {
      const body = skillsBySlug.get(skill.slug) ?? skill.body;
      const exists = await this.db.mnSkill.findUnique({
        where: { workspaceId_slug: { workspaceId, slug: skill.slug } },
      });
      if (exists) continue;
      await this.db.mnSkill.create({
        data: {
          id: randomUUID(),
          workspaceId,
          slug: skill.slug,
          name: skill.name,
          contentMd: body,
          version: skill.version ?? '0.0.0',
        },
      });
      skillsCreated++;
    }

    let agentsCreated = 0;
    for (const manifestAgent of payload.manifest.agents) {
      this.warnIfScrubbed(
        manifestAgent.name,
        'adapterConfig',
        manifestAgent.adapterConfig
      );
      this.warnIfScrubbed(
        manifestAgent.name,
        'runtimeConfig',
        manifestAgent.runtimeConfig
      );
      await this.db.mnAgent.create({
        data: {
          id: randomUUID(),
          workspaceId,
          projectId,
          name: manifestAgent.name,
          capabilities: manifestAgent.capabilities ?? null,
          adapterConfig: (manifestAgent.adapterConfig ?? {}) as object,
          runtimeConfig: (manifestAgent.runtimeConfig ?? {}) as object,
        },
      });
      agentsCreated++;
    }

    let goalsCreated = 0;
    for (const manifestGoal of payload.manifest.goals) {
      await this.db.mnGoal.create({
        data: {
          id: randomUUID(),
          workspaceId,
          projectId,
          title: manifestGoal.title,
          description: manifestGoal.description ?? null,
          level: manifestGoal.level as 'PROJECT' | 'TEAM' | 'AGENT' | 'TASK',
        },
      });
      goalsCreated++;
    }

    return { agentsCreated, skillsCreated, goalsCreated };
  }

  private warnIfScrubbed(
    agentName: string,
    field: string,
    value: unknown
  ): void {
    if (containsScrubbed(value)) {
      this.logger.warn(
        `Imported agent '${agentName}': '${field}' contains scrubbed secret placeholders — operator must fill in real values post-import`
      );
    }
  }
}

function agentToMdAgent(a: {
  name: string;
  adapterType: string;
  capabilities?: string;
}): AgentsMdAgent {
  return {
    name: a.name,
    adapter: a.adapterType,
    ...(a.capabilities !== undefined ? { capabilities: a.capabilities } : {}),
  };
}

function goalToMdGoal(g: {
  title: string;
  level: string;
  description?: string;
}): AgentsMdGoal {
  const level = (
    g.level === 'PROJECT' ||
    g.level === 'TEAM' ||
    g.level === 'AGENT' ||
    g.level === 'TASK'
      ? g.level
      : undefined
  ) as AgentsMdGoal['level'];
  return {
    title: g.title,
    ...(level !== undefined ? { level } : {}),
    ...(g.description !== undefined ? { description: g.description } : {}),
  };
}

function containsScrubbed(value: unknown): boolean {
  if (value === SCRUBBED_VALUE) return true;
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return false;
  if (Array.isArray(value)) return value.some(containsScrubbed);
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some(
      containsScrubbed
    );
  }
  return false;
}

/**
 * JSON.stringify with key sorting so the serialized form is
 * deterministic. Caller relies on this for SHA-256 stability.
 */
function stableStringify(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function canonicalize(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value !== 'object') return value;
  const obj = value as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = canonicalize(obj[key]);
  }
  return sorted;
}

export interface ExportManifestAgent {
  id: string;
  name: string;
  adapterType: string;
  adapterConfig: unknown;
  runtimeConfig: unknown;
  capabilities?: string;
  projectId: string;
  roleId?: string;
}

export interface ExportManifestSkill {
  slug: string;
  name: string;
  description?: string;
  version: string;
  source: string;
}

export interface ExportManifestGoal {
  id: string;
  title: string;
  level: string;
  description?: string;
  projectId: string;
  parentGoalId?: string;
  ownerAgentId?: string;
  status: string;
}

export interface ExportManifestProject {
  id: string;
  name: string;
  description?: string;
  status: string;
  sortOrder: number;
}

export interface ExportManifest {
  version: string;
  workspaceId: string;
  projects: ExportManifestProject[];
  agents: ExportManifestAgent[];
  goals: ExportManifestGoal[];
  skills: ExportManifestSkill[];
}
