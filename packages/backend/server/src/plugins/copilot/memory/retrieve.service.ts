import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

import { MemoryEmbedService } from './embed.service';
import type {
  MemoryKind,
  MemoryScope,
  RetrievedMemory,
  RetrieveMemoryInput,
} from './types';

/**
 * Manut Wave 4 (M5b) — Memory retrieval.
 *
 * Top-K kNN via pgvector cosine distance, scope-filtered to the
 * caller's workspace plus visibility rules:
 *   - `workspace`-scoped rows are visible to any user in the workspace.
 *   - `user`-scoped rows are visible only to the original creator.
 *
 * Failures degrade to an empty list. Like ingest, retrieval is
 * best-effort — a kNN error must NEVER block the chat turn.
 */
@Injectable()
export class MemoryRetrieveService {
  private readonly logger = new Logger(MemoryRetrieveService.name);

  private readonly defaultTopK = 5;
  private readonly defaultScopes: ReadonlyArray<MemoryScope> = [
    'user',
    'workspace',
  ];

  constructor(
    private readonly db: PrismaClient,
    private readonly embedService: MemoryEmbedService
  ) {}

  async retrieve(input: RetrieveMemoryInput): Promise<RetrievedMemory[]> {
    // Defensive top-level wrapper per the v1.12.x prod incident (PR #122
    // chat pipeline failure). Any malformed input — missing workspaceId,
    // non-string query, attachment-shape weirdness — must NOT bubble out
    // of memory retrieval and break the chat turn. Memory is best-effort.
    try {
      const query = input?.query?.trim();
      if (!query || !input?.workspaceId) {
        return [];
      }
      const topK = Math.max(1, Math.min(input.topK ?? this.defaultTopK, 50));
      const scopes = input.scopes?.length
        ? Array.from(new Set(input.scopes))
        : this.defaultScopes;
      const embedding = await this.embedService.embed(query);
      if (!embedding) {
        return [];
      }
      const literal = `[${embedding.join(',')}]`;

      // Filter conditions:
      //   workspace_id = $1 always required.
      //   When the caller asks for `workspace`-scope memories, any user in
      //   the workspace gets them. When the caller asks for `user`-scope,
      //   only the original creator gets them. We OR these so a single
      //   query handles both with the right authorisation.
      const wantsUser = scopes.includes('user');
      const wantsWorkspace = scopes.includes('workspace');
      if (!wantsUser && !wantsWorkspace) {
        return [];
      }

      type Row = {
        id: string;
        content_md: string;
        kind: MemoryKind;
        scope: MemoryScope;
        created_at: Date;
        // distance is only used for debug; not surfaced to caller.
        distance: number | null;
      };

      let rows: Row[] = [];
      if (wantsUser && wantsWorkspace) {
        rows = await this.db.$queryRaw<Row[]>`
          SELECT
            "id",
            "content_md",
            "kind"::text AS "kind",
            "scope",
            "created_at",
            "embedding" <=> ${literal}::vector AS "distance"
          FROM "mn_agent_memories"
          WHERE "workspace_id" = ${input.workspaceId}
            AND "embedding" IS NOT NULL
            AND (
              "scope" = 'workspace'
              OR ("scope" = 'user' AND "user_id" = ${input.userId})
            )
          ORDER BY "embedding" <=> ${literal}::vector ASC
          LIMIT ${topK}
        `;
      } else if (wantsWorkspace) {
        rows = await this.db.$queryRaw<Row[]>`
          SELECT
            "id",
            "content_md",
            "kind"::text AS "kind",
            "scope",
            "created_at",
            "embedding" <=> ${literal}::vector AS "distance"
          FROM "mn_agent_memories"
          WHERE "workspace_id" = ${input.workspaceId}
            AND "embedding" IS NOT NULL
            AND "scope" = 'workspace'
          ORDER BY "embedding" <=> ${literal}::vector ASC
          LIMIT ${topK}
        `;
      } else {
        rows = await this.db.$queryRaw<Row[]>`
          SELECT
            "id",
            "content_md",
            "kind"::text AS "kind",
            "scope",
            "created_at",
            "embedding" <=> ${literal}::vector AS "distance"
          FROM "mn_agent_memories"
          WHERE "workspace_id" = ${input.workspaceId}
            AND "embedding" IS NOT NULL
            AND "scope" = 'user'
            AND "user_id" = ${input.userId}
          ORDER BY "embedding" <=> ${literal}::vector ASC
          LIMIT ${topK}
        `;
      }

      return rows.map(row => ({
        id: row.id,
        content: row.content_md,
        kind: row.kind,
        scope: row.scope,
        createdAt:
          row.created_at instanceof Date
            ? row.created_at
            : new Date(row.created_at),
      }));
    } catch (error) {
      this.logger.warn(
        `MemoryRetrieve: kNN failed (workspace=${input.workspaceId}, user=${input.userId}): ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return [];
    }
  }
}
