import { randomUUID } from 'node:crypto';

import { z } from 'zod';

import type { AccessController } from '../../../core/permission';
import type { Models } from '../../../models';
import type { IndexerService, SearchDoc } from '../../indexer';
import type { DocReadEventBus } from '../doc-read/doc-read-event-bus.service';
import { workspaceSyncRequiredError } from './doc-sync';
import { toolError } from './error';
import { defineTool } from './tool';
import type { CopilotChatOptions } from './types';

export const buildDocKeywordSearchGetter = (
  ac: AccessController,
  indexerService: IndexerService,
  models: Models,
  bus?: DocReadEventBus
) => {
  const searchDocs = async (options: CopilotChatOptions, query?: string) => {
    const queryTrimmed = query?.trim();
    if (!options || !queryTrimmed || !options.user || !options.workspace) {
      return toolError(
        'Doc Keyword Search Failed',
        'Missing workspace, user, or query for doc_keyword_search.'
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
    if (!canAccess) {
      return toolError(
        'Doc Keyword Search Failed',
        'You do not have permission to access this workspace.'
      );
    }
    const docs = await indexerService.searchDocsByKeyword(
      options.workspace,
      queryTrimmed
    );

    // filter current user readable docs
    const readableDocs = await ac
      .user(options.user)
      .workspace(options.workspace)
      .docs(docs, 'Doc.Read');

    // Emit one activation pulse per readable doc the search returned.
    // The graph view dedups via sourceId so a workspace owner with
    // multiple search calls sees a single pulse per docId per call.
    if (bus && readableDocs?.length) {
      const ts = Date.now();
      for (const doc of readableDocs) {
        bus.emit(options.workspace, {
          workspaceId: options.workspace,
          docId: doc.docId,
          sourceId: randomUUID(),
          op: 'searchWorkspace',
          agentId: options.session,
          ts,
        });
      }
    }

    return readableDocs ?? [];
  };
  return searchDocs;
};

export const createDocKeywordSearchTool = (
  searchDocs: (
    query: string
  ) => Promise<SearchDoc[] | ReturnType<typeof toolError>>
) => {
  return defineTool({
    description:
      'Fuzzy search all workspace documents for the exact keyword or phrase supplied and return passages ranked by textual match. Use this tool by default whenever a straightforward term-based or keyword-base lookup is sufficient.',
    inputSchema: z.object({
      query: z
        .string()
        .describe(
          'The query to search for, e.g. "meeting notes" or "project plan".'
        ),
    }),
    execute: async ({ query }) => {
      try {
        const docs = await searchDocs(query);
        if (!Array.isArray(docs)) {
          return docs;
        }
        return docs.map(doc => ({
          docId: doc.docId,
          title: doc.title,
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt,
          createdByUser: doc.createdByUser,
          updatedByUser: doc.updatedByUser,
        }));
      } catch (e: any) {
        return toolError('Doc Keyword Search Failed', e.message);
      }
    },
  });
};
