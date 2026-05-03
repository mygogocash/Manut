import { Controller, Get, Post } from '@nestjs/common';

import { Admin } from '../../core/common/admin-guard';
import { EmbeddingHealthService } from './embedding-health';

/**
 * Admin-only REST controller for embedding/indexing status.
 *
 * Endpoints:
 *   GET  /api/copilot/admin/indexing/stats   — current stats snapshot
 *   POST /api/copilot/admin/indexing/reindex — trigger a full re-index check
 */
@Admin()
@Controller('/api/copilot/admin/indexing')
export class AdminIndexingController {
  constructor(
    private readonly embeddingHealth: EmbeddingHealthService
  ) {}

  @Get('stats')
  async getStats() {
    return this.embeddingHealth.getIndexingStats();
  }

  @Post('reindex')
  async reindex() {
    // Fire-and-forget — the check will run in the background.
    void this.embeddingHealth.checkEmbeddingHealth();
    return { triggered: true };
  }
}
