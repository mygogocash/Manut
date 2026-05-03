import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { EventBus, JobQueue } from '../../base';
import { Models } from '../../models';

export interface IndexingStats {
  totalDocs: number;
  indexedDocs: number;
  pendingDocs: number;
  lastCheckAt: Date;
}

@Injectable()
export class EmbeddingHealthService {
  private readonly logger = new Logger(EmbeddingHealthService.name);

  private lastCheckAt: Date = new Date(0);

  constructor(
    private readonly models: Models,
    private readonly queue: JobQueue,
    private readonly event: EventBus
  ) {}

  /**
   * Hourly health-check: find workspaces with embedding enabled, scan each for
   * docs that are missing embeddings, and re-queue them so they get indexed.
   *
   * This is intentionally lightweight — it only touches workspaces that have
   * `enableDocEmbedding = true` and reuses the existing embedding job pipeline.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async checkEmbeddingHealth(): Promise<void> {
    this.logger.log('Running embedding health check...');
    this.lastCheckAt = new Date();

    try {
      const embeddingAvailable =
        await this.models.copilotContext.checkEmbeddingAvailable();

      if (!embeddingAvailable) {
        this.logger.log('Embedding not available, skipping health check.');
        return;
      }

      // Re-trigger embedding for all workspaces that have the feature enabled.
      // The `workspace.embedding` event handler in CopilotEmbeddingJob already
      // takes care of finding missing docs and queuing them, so we just fan-out
      // the event here rather than duplicating that logic.
      const workspaces = await this.models.workspace.list(
        {},
        { id: true, sid: true }
      );

      let requeued = 0;

      for (const { id: workspaceId } of workspaces) {
        const allowEmbedding =
          await this.models.workspace.allowEmbedding(workspaceId);
        if (!allowEmbedding) continue;

        const toBeEmbedDocIds =
          await this.models.copilotWorkspace.findDocsToEmbed(workspaceId);

        if (!toBeEmbedDocIds.length) continue;

        for (const docId of toBeEmbedDocIds) {
          await this.queue.add(
            'copilot.embedding.docs',
            { workspaceId, docId },
            {
              jobId: `workspace:embedding:${workspaceId}:${docId}`,
              priority: 1,
            }
          );
          requeued++;
        }
      }

      this.logger.log(
        `Embedding health check completed: re-queued ${requeued} missing doc embedding(s).`
      );
    } catch (error: unknown) {
      this.logger.error('Embedding health check failed', error);
    }
  }

  /**
   * Returns aggregated indexing statistics across all workspaces.
   * Used by the admin UI (β-AI-14).
   */
  async getIndexingStats(): Promise<IndexingStats> {
    const embeddingAvailable =
      await this.models.copilotContext.checkEmbeddingAvailable();

    if (!embeddingAvailable) {
      return {
        totalDocs: 0,
        indexedDocs: 0,
        pendingDocs: 0,
        lastCheckAt: this.lastCheckAt,
      };
    }

    const workspaces = await this.models.workspace.list(
      {},
      { id: true, sid: true }
    );

    let totalDocs = 0;
    let indexedDocs = 0;

    for (const { id: workspaceId } of workspaces) {
      const allowEmbedding =
        await this.models.workspace.allowEmbedding(workspaceId);
      if (!allowEmbedding) continue;

      // Docs that already have embeddings
      const embeddedDocIds =
        await this.models.copilotContext.listWorkspaceDocEmbedding(workspaceId);

      // Docs still waiting to be embedded
      const pendingDocIds =
        await this.models.copilotWorkspace.findDocsToEmbed(workspaceId);

      indexedDocs += embeddedDocIds.length;
      totalDocs += embeddedDocIds.length + pendingDocIds.length;
    }

    return {
      totalDocs,
      indexedDocs,
      pendingDocs: totalDocs - indexedDocs,
      lastCheckAt: this.lastCheckAt,
    };
  }
}
