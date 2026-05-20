import { Injectable, Logger } from '@nestjs/common';

import { EMBEDDING_DIMENSIONS } from '../../../models';
import { CopilotProviderFactory } from '../providers/factory';
import { ModelInputType, ModelOutputType } from '../providers/types';

/**
 * Manut Wave 4 (M5b) — Vertex embeddings wrapper.
 *
 * The plan asked for `textembedding-gecko@003` (768 dims). The canonical
 * model on the Manut Vertex stack — used by every other copilot surface
 * (workspace embeddings, context embeddings, doc-semantic-search) — is
 * `gemini-embedding-001` at 1024 dims. The legacy `textembedding-gecko@003`
 * has been deprecated by Google; the plan literally says "or
 * `text-embedding-005` if gecko@003 is deprecated — check the existing
 * Gemini provider for the canonical model id". We choose the canonical
 * id over the plan's hint so we don't fork a parallel embedding stack
 * and keep the dim budget aligned with the rest of pgvector storage.
 *
 * Falls back to a zero-vector embedding if no provider is configured —
 * the auto-router's `configured()` gate then reports memory disabled,
 * the same pattern the workspace-embedding job uses to degrade
 * gracefully on unconfigured deploys (see embedding/client.ts:33-45).
 */
@Injectable()
export class MemoryEmbedService {
  private readonly logger = new Logger(MemoryEmbedService.name);

  /**
   * The Manut Vertex stack canonical embedding model. Kept private so the
   * value can only be overridden via the scenario-config indirection used
   * elsewhere (no caller is allowed to hardcode a different model id).
   */
  private readonly modelId = 'gemini-embedding-001';

  constructor(private readonly providerFactory: CopilotProviderFactory) {}

  /**
   * Generate an embedding for the given text. Returns a 1024-dim vector
   * (matching EMBEDDING_DIMENSIONS / the existing copilot surface).
   *
   * Errors and unconfigured-provider cases return null so the caller can
   * skip the kNN query without crashing the chat-turn pipeline. Memory
   * is a "nice to have" — a missing embedding should never break the
   * user's chat.
   */
  async embed(text: string): Promise<number[] | null> {
    const trimmed = text?.trim();
    if (!trimmed) {
      return null;
    }
    try {
      const provider = await this.providerFactory.getProvider({
        modelId: this.modelId,
        outputType: ModelOutputType.Embedding,
      });
      if (!provider) {
        this.logger.warn(
          'MemoryEmbedService: no embedding provider configured; skipping.'
        );
        return null;
      }
      const embeddings = await provider.embedding(
        { inputTypes: [ModelInputType.Text] },
        [trimmed],
        { dimensions: EMBEDDING_DIMENSIONS }
      );
      const vec = embeddings[0];
      if (!Array.isArray(vec) || vec.length !== EMBEDDING_DIMENSIONS) {
        this.logger.warn(
          `MemoryEmbedService: provider returned malformed embedding (len=${vec?.length ?? 'n/a'}, expected ${EMBEDDING_DIMENSIONS}).`
        );
        return null;
      }
      return vec;
    } catch (error) {
      this.logger.warn(
        `MemoryEmbedService: embed failed: ${error instanceof Error ? error.message : String(error)}`
      );
      return null;
    }
  }

  /**
   * The dimension count the rest of the system assumes (read-only).
   * Surfaced for retrieve.service.ts so kNN queries never index against
   * a different dim than what `embed()` produced.
   */
  get dimensions(): number {
    return EMBEDDING_DIMENSIONS;
  }
}
