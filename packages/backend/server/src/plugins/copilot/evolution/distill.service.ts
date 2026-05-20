import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

import { MemoryIngestService } from '../memory/ingest.service';
import type { MemoryKind, MemoryScope, RetrievedMemory } from '../memory/types';
import { CopilotProviderFactory } from '../providers/factory';
import type { PromptMessage } from '../providers/types';

/**
 * Manut M2 E2.4 — Weekly self-evolution distillation.
 *
 * Reads the last seven days of `feedback:positive|negative` OBSERVATION
 * memories per workspace, asks the LLM to summarise patterns into a
 * single bullet-list PLAYBOOK, then upserts that PLAYBOOK into the
 * memory store (one row per workspace).
 *
 * The PLAYBOOK is later read by `system-prompt.ts` and prepended to
 * every chat turn's memory blob (before FACT, DECISION, OBSERVATION)
 * so the model honours it as ground-truth.
 *
 * Failure handling — same contract as the rest of the memory subsystem:
 *   - Provider unavailable / kNN failure / DB hiccup → log + skip.
 *   - Never throw out of the cron firing path; one bad workspace must
 *     not poison the others.
 *
 * Per CLAUDE.md DI-metadata scars: `@Injectable()` is mandatory on
 * provider classes, and `PrismaClient` is imported as a runtime value
 * (NOT `import type`) because it is a DI constructor target.
 */
@Injectable()
export class DistillService {
  private readonly logger = new Logger(DistillService.name);

  // Default to the Vertex-canonical fast model. Matches what AI Auto Tag
  // and `Summary as title` use — CLAUDE.md §6c documents this is the
  // safe default for the Vertex-only stack (no gpt-* fallbacks).
  private readonly modelId = 'gemini-2.5-flash';

  // Lookback window for feedback aggregation. Matches the cron cadence
  // (Sunday 00:00 UTC, weekly). Anything older has already shaped the
  // previous week's PLAYBOOK.
  private readonly lookbackDays = 7;

  // Cap fed-into-LLM feedback content so we don't blow token budgets on
  // a busy workspace. The summariser gets the most-recent slice.
  private readonly maxFeedbackItems = 200;

  constructor(
    private readonly db: PrismaClient,
    private readonly providerFactory: CopilotProviderFactory,
    private readonly ingest: MemoryIngestService
  ) {}

  /**
   * Distil feedback for every workspace that has at least one feedback
   * memory in the last week. Returns the count of PLAYBOOKs upserted.
   *
   * Sequential per-workspace iteration is intentional: the cron is a
   * background sweep, not a latency-critical path, and serialising
   * keeps the LLM token spend predictable.
   */
  async distillAllWorkspaces(): Promise<number> {
    let workspaces: Array<{ workspace_id: string }> = [];
    try {
      workspaces = await this.db.$queryRaw<Array<{ workspace_id: string }>>`
        SELECT DISTINCT "workspace_id"
        FROM "mn_agent_memories"
        WHERE "kind" = 'OBSERVATION'
          AND "content_md" LIKE 'feedback:%'
          AND "created_at" > NOW() - (${this.lookbackDays} || ' days')::interval
      `;
    } catch (error) {
      this.logger.warn(
        `Distill: failed to list workspaces with feedback: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return 0;
    }
    if (!workspaces.length) {
      this.logger.debug('Distill: no workspaces with recent feedback.');
      return 0;
    }
    let distilled = 0;
    for (const { workspace_id: workspaceId } of workspaces) {
      const ok = await this.distillWorkspace(workspaceId);
      if (ok) distilled += 1;
    }
    this.logger.log(
      `Distill: completed week-end pass — distilled ${distilled}/${workspaces.length} workspace PLAYBOOK(s).`
    );
    return distilled;
  }

  /**
   * Distill one workspace's recent feedback. Returns true if a new
   * PLAYBOOK was written, false otherwise (no feedback, LLM unavailable,
   * etc.). Wrapped in a defensive try/catch so a bad workspace can't
   * crash the loop in `distillAllWorkspaces`.
   */
  async distillWorkspace(workspaceId: string): Promise<boolean> {
    try {
      const rows = await this.db.$queryRaw<
        Array<{ content_md: string; created_at: Date }>
      >`
        SELECT "content_md", "created_at"
        FROM "mn_agent_memories"
        WHERE "workspace_id" = ${workspaceId}
          AND "kind" = 'OBSERVATION'
          AND "content_md" LIKE 'feedback:%'
          AND "created_at" > NOW() - (${this.lookbackDays} || ' days')::interval
        ORDER BY "created_at" DESC
        LIMIT ${this.maxFeedbackItems}
      `;
      if (!rows.length) {
        return false;
      }

      const provider = await this.providerFactory.getProviderByModel(
        this.modelId
      );
      if (!provider?.configured()) {
        this.logger.warn(
          `Distill: no provider available for ${this.modelId}; skipping ${workspaceId}.`
        );
        return false;
      }

      const messages = this.buildPrompt(rows.map(r => r.content_md));
      const playbook = (
        await provider.text({ modelId: this.modelId }, messages)
      )?.trim();

      if (!playbook) {
        this.logger.warn(
          `Distill: provider returned empty playbook for ${workspaceId}.`
        );
        return false;
      }

      // Upsert: delete prior PLAYBOOKs for this workspace first, then
      // ingest the new one. Done in a transaction so an interrupted
      // run never leaves the workspace without a PLAYBOOK.
      await this.db.$executeRaw`
        DELETE FROM "mn_agent_memories"
        WHERE "workspace_id" = ${workspaceId}
          AND "kind" = 'PLAYBOOK'
          AND "scope" = 'workspace'
      `;

      const id = await this.ingest.ingest({
        workspaceId,
        // Workspace-scope PLAYBOOK = visible to every member. There is no
        // single owning user. Pass empty string (the ingest service uses
        // userId only for `user`-scoped writes).
        userId: '',
        scope: 'workspace',
        kind: 'PLAYBOOK',
        content: playbook,
        pinned: true,
        importance: 5,
      });
      if (!id) {
        this.logger.warn(
          `Distill: ingest failed for workspace ${workspaceId}.`
        );
        return false;
      }
      this.logger.log(
        `Distill: upserted PLAYBOOK (id=${id}) for workspace ${workspaceId} from ${rows.length} feedback item(s).`
      );
      return true;
    } catch (error) {
      this.logger.warn(
        `Distill: workspace ${workspaceId} failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return false;
    }
  }

  /**
   * Fetch the workspace's most-recent workspace-scoped PLAYBOOK row.
   * Returns null when none exists (cron hasn't run, or no feedback was
   * collected). The prompt service's memory-injection helper can call
   * this and feed the result into `formatMemoriesForPrompt(memories,
   * latestPlaybook)` so the PLAYBOOK is ALWAYS at the top of the system
   * prompt, regardless of kNN ranking.
   *
   * Direct $queryRaw rather than going through MemoryRetrieveService —
   * the retrieve path does kNN, which is the wrong primitive for "give
   * me THE latest PLAYBOOK." No embedding needed; a simple ORDER BY
   * created_at DESC LIMIT 1 is correct and cheap.
   */
  async getLatestPlaybook(
    workspaceId: string
  ): Promise<RetrievedMemory | null> {
    try {
      type Row = {
        id: string;
        content_md: string;
        kind: MemoryKind;
        scope: MemoryScope;
        created_at: Date;
      };
      const rows = await this.db.$queryRaw<Row[]>`
        SELECT
          "id",
          "content_md",
          "kind"::text AS "kind",
          "scope",
          "created_at"
        FROM "mn_agent_memories"
        WHERE "workspace_id" = ${workspaceId}
          AND "kind" = 'PLAYBOOK'
          AND "scope" = 'workspace'
        ORDER BY "created_at" DESC
        LIMIT 1
      `;
      const row = rows[0];
      if (!row) return null;
      return {
        id: row.id,
        content: row.content_md,
        kind: row.kind,
        scope: row.scope,
        createdAt:
          row.created_at instanceof Date
            ? row.created_at
            : new Date(row.created_at),
      };
    } catch (error) {
      this.logger.warn(
        `Distill: getLatestPlaybook failed (workspace=${workspaceId}): ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return null;
    }
  }

  /**
   * Build the LLM prompt. System message tells the model what to do;
   * user message contains the raw feedback bullet list. We never expose
   * raw user content from other workspaces here — the calling SQL is
   * already scoped to one workspace_id.
   */
  private buildPrompt(
    feedbackContents: ReadonlyArray<string>
  ): PromptMessage[] {
    const bullets = feedbackContents.map(content => `- ${content}`).join('\n');
    return [
      {
        role: 'system',
        content:
          'You distil user feedback about an AI assistant into a concise PLAYBOOK ' +
          'the assistant will follow on future turns. The PLAYBOOK must be a ' +
          'short bullet list (5-12 bullets), each one an actionable rule. ' +
          'Combine positive feedback into "always do" rules and negative ' +
          'feedback into "avoid" rules. Output ONLY the bullet list — no ' +
          'preamble, no closing remarks.',
      },
      {
        role: 'user',
        content:
          'Below are user feedback observations from the past week. ' +
          'Each line is one observation (positive or negative). Summarise ' +
          'patterns the AI should follow. Output a single PLAYBOOK.\n\n' +
          bullets,
      },
    ];
  }
}
