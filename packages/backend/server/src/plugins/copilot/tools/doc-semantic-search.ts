import { randomUUID } from 'node:crypto';

import { omit } from 'lodash-es';
import { z } from 'zod';

import type { AccessController } from '../../../core/permission';
import {
  type ChunkSimilarity,
  clearEmbeddingChunk,
  type DocChunkSimilarity,
  type Models,
} from '../../../models';
import type { DocReadEventBus } from '../doc-read/doc-read-event-bus.service';
import type { AuthorizedRetrievalFilter } from '../security';
import { resolveReadableDocIdsFromAccess } from '../security';
import { workspaceSyncRequiredError } from './doc-sync';
import { toolError } from './error';
import { defineTool } from './tool';
import type {
  ContextSession,
  CopilotChatOptions,
  CopilotContextService,
} from './types';

export const buildDocSearchGetter = (
  ac: AccessController,
  context: CopilotContextService,
  docContext: ContextSession | null,
  models: Models,
  bus?: DocReadEventBus,
  authorization?: AuthorizedRetrievalFilter
) => {
  const searchDocs = async (
    options: CopilotChatOptions,
    query?: string,
    signal?: AbortSignal
  ) => {
    if (!options || !query?.trim() || !options.user || !options.workspace) {
      return toolError(
        'Doc Semantic Search Failed',
        'Missing workspace, user, or query for doc_semantic_search.'
      );
    }
    const workspace = await models.workspace.get(options.workspace);
    if (!workspace) {
      return workspaceSyncRequiredError();
    }
    const canAccess = await ac
      .user(options.user)
      .workspace(options.workspace)
      .can('Workspace.Read');
    if (!canAccess)
      return toolError(
        'Doc Semantic Search Failed',
        'You do not have permission to access this workspace.'
      );
    const authorizedDocIds = authorization
      ? await authorization.resolveReadableDocIds({
          userId: options.user,
          workspaceId: options.workspace,
        })
      : await resolveReadableDocIdsFromAccess(ac, models, {
          userId: options.user,
          workspaceId: options.workspace,
        });

    const [chunks, contextChunks] = await Promise.all([
      context.matchWorkspaceAll(
        options.workspace,
        query,
        10,
        signal,
        0.8,
        undefined,
        0.85,
        authorizedDocIds
      ),
      docContext?.matchFiles(query, 10, signal) ?? [],
    ]);

    const docCandidateChunks = chunks.filter(
      (chunk): chunk is DocChunkSimilarity => 'docId' in chunk
    ) as DocChunkSimilarity[];
    const docChunks = await ac
      .user(options.user)
      .workspace(options.workspace)
      .docs(docCandidateChunks, 'Doc.Read');
    const blobChunks = chunks.filter(c => 'blobId' in c);
    const fileChunks = chunks.filter(c => 'fileId' in c);
    if (contextChunks.length) {
      fileChunks.push(...contextChunks);
    }
    if (!blobChunks.length && !docChunks.length && !fileChunks.length) {
      return [];
    }

    // Emit one activation pulse per unique doc the semantic search
    // touched. Semantic search returns chunks (multiple per doc), so
    // we collapse to docId to avoid spamming the graph view.
    if (bus && docChunks.length) {
      const ts = Date.now();
      const seenDocIds = new Set<string>();
      for (const chunk of docChunks) {
        if (seenDocIds.has(chunk.docId)) continue;
        seenDocIds.add(chunk.docId);
        bus.emit(options.workspace, {
          workspaceId: options.workspace,
          docId: chunk.docId,
          sourceId: randomUUID(),
          op: 'searchWorkspace',
          agentId: options.session,
          ts,
        });
      }
    }

    const docIds = docChunks.map(c => ({
      // oxlint-disable-next-line no-non-null-assertion
      workspaceId: options.workspace!,
      docId: c.docId,
    }));
    const docAuthors = await models.doc
      .findAuthors(docIds)
      .then(
        docs =>
          new Map(
            docs
              .filter(d => !!d)
              .map(doc => [doc.id, omit(doc, ['id', 'workspaceId'])])
          )
      );
    const docMetas = await models.doc
      .findMetas(docIds, { select: { title: true } })
      .then(
        docs =>
          new Map(
            docs
              .filter(d => !!d)
              .map(doc => [
                doc.docId,
                Object.assign({}, doc, docAuthors.get(doc.docId)),
              ])
          )
      );

    return [
      ...fileChunks.map(clearEmbeddingChunk),
      ...blobChunks.map(clearEmbeddingChunk),
      ...docChunks.map(c => ({
        ...c,
        ...docMetas.get(c.docId),
      })),
    ] as ChunkSimilarity[];
  };
  return searchDocs;
};

export const createDocSemanticSearchTool = (
  searchDocs: (
    query: string,
    signal?: AbortSignal
  ) => Promise<ChunkSimilarity[] | ReturnType<typeof toolError>>
) => {
  return defineTool({
    description:
      'Retrieve conceptually related passages by performing vector-based semantic similarity search across embedded documents; use this tool only when exact keyword search fails or the user explicitly needs meaning-level matches (e.g., paraphrases, synonyms, broader concepts, recent documents).',
    inputSchema: z.object({
      query: z
        .string()
        .describe(
          'The query statement to search for, e.g. "What is the capital of France?"\nWhen querying specific terms or IDs, you should provide the complete string instead of separating it with delimiters.\nFor example, if a user wants to look up the ID "sicDoe1is", use "What is sicDoe1is" instead of "si code 1is".'
        ),
    }),
    execute: async ({ query }, options) => {
      try {
        return await searchDocs(query, options.signal);
      } catch (e: any) {
        return toolError('Doc Semantic Search Failed', e.message);
      }
    },
  });
};
