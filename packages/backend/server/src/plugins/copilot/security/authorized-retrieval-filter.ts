import { Injectable, Logger } from '@nestjs/common';

import { AccessController } from '../../../core/permission';
import { Models } from '../../../models';

export interface ResolveReadableDocIdsInput {
  userId: string;
  workspaceId: string;
  candidateDocIds?: string[];
}

export interface AuthorizedRetrievalFilter {
  resolveReadableDocIds(input: ResolveReadableDocIdsInput): Promise<string[]>;
}

function uniqueDocIds(docIds: readonly string[]): string[] {
  return Array.from(new Set(docIds.filter(Boolean)));
}

export async function resolveReadableDocIdsFromAccess(
  ac: AccessController,
  models: Models,
  input: ResolveReadableDocIdsInput
): Promise<string[]> {
  const candidateDocIds =
    input.candidateDocIds ??
    (await models.copilotWorkspace?.listEmbeddableDocIds?.(
      input.workspaceId
    )) ??
    [];
  const docIds = uniqueDocIds(candidateDocIds);
  if (!docIds.length) {
    return [];
  }

  const readable = await ac
    .user(input.userId)
    .workspace(input.workspaceId)
    .docs(
      docIds.map(docId => ({ docId })),
      'Doc.Read'
    );

  return uniqueDocIds(readable.map(doc => doc.docId));
}

/**
 * Builds the pre-retrieval document allowlist for copilot search tools.
 *
 * The old search flow retrieved broad workspace candidates and filtered them
 * afterward. This service resolves readable document ids before the search
 * backend runs so vector/keyword retrieval can be physically constrained.
 */
@Injectable()
export class AuthorizedRetrievalFilterService implements AuthorizedRetrievalFilter {
  private readonly logger = new Logger(AuthorizedRetrievalFilterService.name);

  constructor(
    private readonly ac: AccessController,
    private readonly models: Models
  ) {}

  async resolveReadableDocIds(
    input: ResolveReadableDocIdsInput
  ): Promise<string[]> {
    try {
      return await resolveReadableDocIdsFromAccess(this.ac, this.models, input);
    } catch (error) {
      this.logger.warn(
        `Failed to resolve authorized retrieval docs (workspace=${input.workspaceId}, user=${input.userId}): ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return [];
    }
  }
}
