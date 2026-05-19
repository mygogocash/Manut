import { Injectable, NotFoundException } from '@nestjs/common';
import {
  Args,
  Field,
  ID,
  Mutation,
  ObjectType,
  Query,
  registerEnumType,
  Resolver,
} from '@nestjs/graphql';
import { PrismaClient } from '@prisma/client';

import { Throttle } from '../../../base';
import { CurrentUser } from '../../../core/auth';
import { AccessController } from '../../../core/permission';
import type { MemoryKind, MemoryScope } from './types';

/**
 * Manut Wave 5 (M2 — E2.2) — "What AI knows about me" GraphQL surface.
 *
 * Companion to the B7 ingest/retrieve services (commit eb92e4b53). This
 * resolver lets the new Settings → Account → Memory panel:
 *
 *   1. `myMemories(workspaceId)` — list the caller's user-scope memories
 *      plus all workspace-scope memories that any member can read.
 *   2. `pinMemory(id)` — toggle the row's `pinned` flag.
 *   3. `forgetMemory(id)` — hard delete (writes are best-effort + the
 *      embedding column survives via cascade-on-row-delete).
 *   4. `promoteMemoryToWorkspace(id)` — flip a `user`-scoped row to
 *      `workspace`-scope so all members of the workspace can recall it.
 *      `user_id` is nulled at the same time (workspace-scope rows leave
 *      `user_id` NULL — see retrieve.service.ts visibility rules).
 *
 * Authorisation:
 *
 * - `myMemories` requires `Workspace.Read` on the workspaceId (any
 *    workspace member can list the workspace-scope memories; user-scope
 *    rows are auto-filtered to user_id = currentUser.id).
 * - `pinMemory` / `forgetMemory` / `promoteMemoryToWorkspace` each
 *    re-derive workspaceId from the row, then assert `Workspace.Read`.
 *    Mutating ops additionally require:
 *    * pin / forget on user-scope: caller must be the row owner.
 *    * pin / forget on workspace-scope: caller must have
 *      `Workspace.Settings.Update` (mirrors how workspace-wide ignored
 *      docs are managed in CopilotWorkspaceEmbeddingConfigResolver).
 *    * promoteMemoryToWorkspace: row must be `user`-scope AND owned by
 *      the caller; the promote itself also needs
 *      `Workspace.Settings.Update` since it widens visibility.
 *
 * CLAUDE.md v1.7.0/v1.10.2 scar: every nullable `@Field` carries an
 * explicit `(() => Type)` parameter. The NestJS reflector cannot infer
 * GraphQL types from `string | null` unions — shipping without the
 * arrow form crashed startup twice before. Even `id`/`content` use
 * explicit `() => ID`/`() => String` so a future "make it nullable"
 * refactor doesn't trip on the same nail.
 *
 * CLAUDE.md v1.12.0 DI-metadata scars: `@Injectable()` is mandatory on
 * provider classes, and `PrismaClient` / `AccessController` are
 * runtime imports (no `import type`) so the constructor's
 * `design:paramtypes` metadata reflects the real classes.
 */

// Register the union as a GraphQL enum so the frontend gets a typed
// surface to switch over. `MemoryScope` lives in types.ts as a string
// literal union, mirrored here as a TS object for `registerEnumType`.
export const MemoryScopeEnum = {
  user: 'user',
  workspace: 'workspace',
} as const;
type MemoryScopeEnum = (typeof MemoryScopeEnum)[keyof typeof MemoryScopeEnum];

registerEnumType(MemoryScopeEnum, { name: 'MemoryScopeEnum' });

export const MemoryKindEnum = {
  FACT: 'FACT',
  DECISION: 'DECISION',
  OBSERVATION: 'OBSERVATION',
  PLAYBOOK: 'PLAYBOOK',
} as const;
type MemoryKindEnum = (typeof MemoryKindEnum)[keyof typeof MemoryKindEnum];

registerEnumType(MemoryKindEnum, { name: 'MemoryKindEnum' });

/**
 * GraphQL Memory ObjectType — the trimmed shape the Settings panel
 * cares about. The DB row carries more (importance, retrieved_count,
 * lastRetrievedAt, embedding) but those are operator-only signals; the
 * panel only needs what a user can act on.
 */
@ObjectType('Memory')
export class MemoryType {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  content!: string;

  @Field(() => MemoryKindEnum)
  kind!: MemoryKind;

  @Field(() => MemoryScopeEnum)
  scope!: MemoryScope;

  @Field(() => Boolean)
  pinned!: boolean;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => String)
  workspaceId!: string;
}

interface MemoryRow {
  id: string;
  workspace_id: string;
  content_md: string;
  kind: MemoryKind;
  scope: MemoryScope;
  pinned: boolean;
  user_id: string | null;
  created_at: Date;
}

function toMemoryType(row: MemoryRow): MemoryType {
  return {
    id: row.id,
    content: row.content_md,
    kind: row.kind,
    scope: row.scope,
    pinned: row.pinned,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at
        : new Date(row.created_at),
    workspaceId: row.workspace_id,
  };
}

@Throttle()
@Injectable()
@Resolver(() => MemoryType)
export class MemoryResolver {
  constructor(
    private readonly ac: AccessController,
    private readonly db: PrismaClient
  ) {}

  /**
   * List memories the caller can see in `workspaceId`:
   *   - all `workspace`-scope rows.
   *   - all `user`-scope rows owned by `currentUser.id`.
   *
   * Pinned rows come first; within each pinned/unpinned bucket we sort
   * by `createdAt` DESC so the most recent learning surfaces at the
   * top.
   */
  @Query(() => [MemoryType], {
    description:
      'List memories the current user can recall in this workspace ' +
      '(personal + workspace-scope). Pinned rows first, newest first.',
  })
  async myMemories(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => String }) workspaceId: string
  ): Promise<MemoryType[]> {
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .allowLocal()
      .assert('Workspace.Read');

    const rows = await this.db.$queryRaw<MemoryRow[]>`
      SELECT
        "id",
        "workspace_id",
        "content_md",
        "kind"::text AS "kind",
        "scope",
        "pinned",
        "user_id",
        "created_at"
      FROM "mn_agent_memories"
      WHERE "workspace_id" = ${workspaceId}
        AND (
          "scope" = 'workspace'
          OR ("scope" = 'user' AND "user_id" = ${user.id})
        )
      ORDER BY "pinned" DESC, "created_at" DESC
      LIMIT 500
    `;

    return rows.map(toMemoryType);
  }

  /**
   * Toggle a memory's `pinned` flag.
   *
   * AuthZ: row must belong to a workspace the caller has Read on, AND
   * either be owned by the caller (user-scope) or the caller must hold
   * `Workspace.Settings.Update` (workspace-scope).
   */
  @Mutation(() => MemoryType, {
    description:
      'Toggle the pinned flag on a memory. Pinned memories surface ahead ' +
      'of unpinned ones during AI recall.',
  })
  async pinMemory(
    @CurrentUser() user: CurrentUser,
    @Args('id', { type: () => ID }) id: string
  ): Promise<MemoryType> {
    const row = await this.requireOwnedRow(user, id, /* requireWrite */ true);

    const next = await this.db.$queryRaw<MemoryRow[]>`
      UPDATE "mn_agent_memories"
      SET "pinned" = NOT "pinned",
          "updated_at" = NOW()
      WHERE "id" = ${id}
      RETURNING
        "id",
        "workspace_id",
        "content_md",
        "kind"::text AS "kind",
        "scope",
        "pinned",
        "user_id",
        "created_at"
    `;
    const head = next[0];
    if (!head) {
      // Lost-race / row vanished between fetch + update.
      throw new NotFoundException(`Memory ${row.id} not found`);
    }
    return toMemoryType(head);
  }

  /**
   * Hard delete a memory.
   *
   * AuthZ same as `pinMemory`. Forget is intentionally destructive: the
   * user asked us to stop knowing this, so we don't leave a tombstone.
   */
  @Mutation(() => Boolean, {
    description: 'Hard-delete a memory the AI has stored about the user.',
  })
  async forgetMemory(
    @CurrentUser() user: CurrentUser,
    @Args('id', { type: () => ID }) id: string
  ): Promise<boolean> {
    await this.requireOwnedRow(user, id, /* requireWrite */ true);
    await this.db.$executeRaw`
      DELETE FROM "mn_agent_memories" WHERE "id" = ${id}
    `;
    return true;
  }

  /**
   * Widen a `user`-scope row to `workspace`-scope so any workspace
   * member can recall it. Nulls `user_id` to match how ingest writes
   * fresh workspace-scope rows.
   *
   * AuthZ: caller must be the row owner AND hold
   * `Workspace.Settings.Update` (widening visibility is a
   * workspace-level change).
   */
  @Mutation(() => MemoryType, {
    description:
      'Promote a personal (user-scope) memory to workspace-scope so any ' +
      'member can recall it.',
  })
  async promoteMemoryToWorkspace(
    @CurrentUser() user: CurrentUser,
    @Args('id', { type: () => ID }) id: string
  ): Promise<MemoryType> {
    const row = await this.requireOwnedRow(user, id, /* requireWrite */ true);

    if (row.scope !== 'user') {
      // Already workspace-scope — surface as a not-found to keep the
      // resolver idempotent without leaking row state.
      throw new NotFoundException(
        `Memory ${id} is not a user-scope row and cannot be promoted`
      );
    }
    if (row.user_id !== user.id) {
      throw new NotFoundException(
        `Memory ${id} is not owned by the current user`
      );
    }

    // Workspace.Settings.Update is the project's pattern for widening
    // visibility (see CopilotWorkspaceEmbeddingConfigResolver). Re-assert
    // here even though requireOwnedRow already asserted Read.
    await this.ac
      .user(user.id)
      .workspace(row.workspace_id)
      .allowLocal()
      .assert('Workspace.Settings.Update');

    const next = await this.db.$queryRaw<MemoryRow[]>`
      UPDATE "mn_agent_memories"
      SET "scope" = 'workspace',
          "user_id" = NULL,
          "updated_at" = NOW()
      WHERE "id" = ${id}
      RETURNING
        "id",
        "workspace_id",
        "content_md",
        "kind"::text AS "kind",
        "scope",
        "pinned",
        "user_id",
        "created_at"
    `;
    const head = next[0];
    if (!head) {
      throw new NotFoundException(`Memory ${id} not found`);
    }
    return toMemoryType(head);
  }

  /**
   * Fetch a row and assert the caller is allowed to read (and
   * optionally write) it. Centralises the auth ladder for the three
   * mutating ops above.
   */
  private async requireOwnedRow(
    user: CurrentUser,
    id: string,
    requireWrite: boolean
  ): Promise<MemoryRow> {
    const rows = await this.db.$queryRaw<MemoryRow[]>`
      SELECT
        "id",
        "workspace_id",
        "content_md",
        "kind"::text AS "kind",
        "scope",
        "pinned",
        "user_id",
        "created_at"
      FROM "mn_agent_memories"
      WHERE "id" = ${id}
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) {
      throw new NotFoundException(`Memory ${id} not found`);
    }

    // Read gate first — same baseline for everyone.
    await this.ac
      .user(user.id)
      .workspace(row.workspace_id)
      .allowLocal()
      .assert('Workspace.Read');

    if (!requireWrite) {
      return row;
    }

    if (row.scope === 'user') {
      // Personal row — only the original creator can mutate.
      if (row.user_id !== user.id) {
        throw new NotFoundException(`Memory ${id} not found`);
      }
      return row;
    }

    // Workspace-scope rows — anyone with Settings.Update may mutate.
    await this.ac
      .user(user.id)
      .workspace(row.workspace_id)
      .allowLocal()
      .assert('Workspace.Settings.Update');

    return row;
  }
}
