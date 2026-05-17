import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { MnSkill } from '@prisma/client';
import { MnSkillSource, PrismaClient } from '@prisma/client';

import {
  CreateMnSkillSchema,
  type CreateMnSkillValues,
  UpdateMnSkillSchema,
  type UpdateMnSkillValues,
} from './manut-skill.dto';

/**
 * CRUD for Manut Skills (M5.1).
 *
 * Invariants enforced here (NOT in the resolver) so direct service
 * callers (CLI, AGENTS.md import in Branch B, future MCP bridge) get
 * the same guarantees as GraphQL clients:
 *
 *  1. `slug` is unique per workspace (`@@unique([workspaceId, slug])` in
 *     Prisma). Conflicts surface as `BadRequestException` with a
 *     readable message rather than the raw Prisma P2002.
 *  2. `version` MUST change whenever `contentMd` changes. Updates that
 *     touch `contentMd` without bumping `version` are rejected with
 *     422-equivalent `BadRequestException` so cached consumers cannot
 *     silently serve stale content for a fresh body.
 *  3. Archived skills are excluded from default list responses; callers
 *     pass `includeArchived=true` to inspect the full history.
 *
 * CLAUDE.md scars honored:
 *  - `@Injectable()` is present so TS emits `design:paramtypes` and
 *    NestJS DI can resolve `PrismaClient` (v1.12.0 production scar).
 *  - `PrismaClient` is a RUNTIME import, not `import type`, so the
 *    constructor parameter metadata reflects the real class
 *    (v1.12.0 production scar).
 *  - Row types like `MnSkill` ARE imported via `import type` — pure
 *    type usage is fine and keeps the runtime bundle smaller.
 */
@Injectable()
export class MnSkillService {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Create a new skill inside `workspaceId`. The caller is responsible
   * for permission checks; this method enforces data invariants
   * (slug uniqueness, version + contentMd parity).
   */
  async create(
    workspaceId: string,
    input: CreateMnSkillValues
  ): Promise<MnSkill> {
    const values = CreateMnSkillSchema.parse(input);

    const conflict = await this.db.mnSkill.findUnique({
      where: {
        workspaceId_slug: { workspaceId, slug: values.slug },
      },
    });
    if (conflict) {
      throw new BadRequestException(
        `Skill with slug '${values.slug}' already exists in this workspace`
      );
    }

    return this.db.mnSkill.create({
      data: {
        id: randomUUID(),
        workspaceId,
        slug: values.slug,
        name: values.name,
        description: values.description ?? null,
        contentMd: values.contentMd,
        version: values.version,
        source: values.source ?? MnSkillSource.WORKSPACE,
      },
    });
  }

  /**
   * List skills in a workspace, newest first. By default excludes
   * archived skills; pass `includeArchived` to see them too.
   */
  async list(
    workspaceId: string,
    options: { includeArchived?: boolean } = {}
  ): Promise<MnSkill[]> {
    return this.db.mnSkill.findMany({
      where: {
        workspaceId,
        ...(options.includeArchived ? {} : { archivedAt: null }),
      },
      orderBy: [{ updatedAt: 'desc' }],
    });
  }

  /**
   * Get a single skill by id, scoped to `workspaceId` so callers can't
   * dereference an id leaked from another workspace.
   */
  async get(workspaceId: string, skillId: string): Promise<MnSkill | null> {
    const row = await this.db.mnSkill.findUnique({ where: { id: skillId } });
    if (!row || row.workspaceId !== workspaceId) return null;
    return row;
  }

  /**
   * Get by `(workspaceId, slug)` — the natural lookup used by import
   * + export + UI search. Returns null when missing.
   */
  async getBySlug(workspaceId: string, slug: string): Promise<MnSkill | null> {
    return this.db.mnSkill.findUnique({
      where: { workspaceId_slug: { workspaceId, slug } },
    });
  }

  /**
   * Same as `get`, but throws `NotFoundException` on miss. Used by
   * mutations where we need to fail loudly rather than silently no-op.
   */
  async getOrThrow(workspaceId: string, skillId: string): Promise<MnSkill> {
    const row = await this.get(workspaceId, skillId);
    if (!row) {
      throw new NotFoundException(`Skill '${skillId}' not found`);
    }
    return row;
  }

  /**
   * Patch editable fields on a skill. Enforces the version-bump rule:
   * changing `contentMd` without changing `version` is rejected.
   *
   * Returns the freshly-read row, not the merged input, so the caller
   * always sees the canonical DB state including `updatedAt`.
   */
  async update(
    workspaceId: string,
    skillId: string,
    input: UpdateMnSkillValues
  ): Promise<MnSkill> {
    const values = UpdateMnSkillSchema.parse(input);
    const current = await this.getOrThrow(workspaceId, skillId);

    const nextContent =
      values.contentMd !== undefined && values.contentMd !== null
        ? values.contentMd
        : current.contentMd;
    const nextVersion =
      values.version !== undefined && values.version !== null
        ? values.version
        : current.version;

    // The version-bump invariant. The whole point of the version string
    // is that it changes whenever the body changes — caches and import
    // dedup depend on this. Reject silent rewrites.
    if (nextContent !== current.contentMd && nextVersion === current.version) {
      throw new BadRequestException(
        `Skill '${skillId}': contentMd changed but version did not — bump the version when editing skill content`
      );
    }

    return this.db.mnSkill.update({
      where: { id: skillId },
      data: {
        ...(values.name !== undefined && values.name !== null
          ? { name: values.name }
          : {}),
        ...(values.description !== undefined
          ? { description: values.description }
          : {}),
        ...(values.contentMd !== undefined && values.contentMd !== null
          ? { contentMd: values.contentMd }
          : {}),
        ...(values.version !== undefined && values.version !== null
          ? { version: values.version }
          : {}),
      },
    });
  }

  /**
   * Soft-delete a skill: set `archivedAt`. Listing without
   * `includeArchived=true` excludes archived rows. Archived skills are
   * preserved so existing exports / runs that reference them keep
   * resolving — see `MnExportSnapshotService`.
   */
  async archive(workspaceId: string, skillId: string): Promise<MnSkill> {
    const current = await this.getOrThrow(workspaceId, skillId);
    if (current.archivedAt !== null) {
      // Idempotent — already archived rows are returned unchanged.
      return current;
    }
    return this.db.mnSkill.update({
      where: { id: skillId },
      data: { archivedAt: new Date() },
    });
  }

  /**
   * Restore a previously-archived skill. Used by the UI's
   * "show archived" toggle when a user wants to bring something back.
   */
  async restore(workspaceId: string, skillId: string): Promise<MnSkill> {
    const current = await this.getOrThrow(workspaceId, skillId);
    if (current.archivedAt === null) {
      return current;
    }
    return this.db.mnSkill.update({
      where: { id: skillId },
      data: { archivedAt: null },
    });
  }
}
