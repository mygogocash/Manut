import { Injectable } from '@nestjs/common';
import { pick } from 'lodash-es';
import z from 'zod/v3';

import { DocReader, DocWriter } from '../../../core/doc';
import { PgWorkspaceDocStorageAdapter } from '../../../core/doc/adapters/workspace';
import { AccessController } from '../../../core/permission';
import { clearEmbeddingChunk } from '../../../models';
import { IndexerService } from '../../indexer';
import { SearchTable } from '../../indexer/tables';
import { SearchQueryOccur, SearchQueryType } from '../../indexer/types';
import { CopilotContextService } from '../context/service';

type McpTextContent = {
  type: 'text';
  text: string;
};

export type WorkspaceMcpToolResult = {
  content: McpTextContent[];
  isError?: boolean;
};

export type WorkspaceMcpToolDefinition = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (
    args: Record<string, unknown>,
    options: { signal: AbortSignal }
  ) => Promise<WorkspaceMcpToolResult>;
};

export type WorkspaceMcpServer = {
  name: string;
  version: string;
  tools: WorkspaceMcpToolDefinition[];
};

type ToolExecutorInput<T extends z.ZodTypeAny> = {
  name: string;
  title: string;
  description: string;
  parser: T;
  inputSchema: Record<string, unknown>;
  execute: (
    args: z.infer<T>,
    options: { signal: AbortSignal }
  ) => Promise<WorkspaceMcpToolResult>;
};

function toolText(text: string): WorkspaceMcpToolResult {
  return {
    content: [{ type: 'text', text }],
  };
}

function toolError(message: string): WorkspaceMcpToolResult {
  return {
    isError: true,
    content: [{ type: 'text', text: message }],
  };
}

function toInputError(error: z.ZodError) {
  const details = error.issues
    .map(issue => {
      const path = issue.path.join('.');
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join('; ');
  return toolError(`Invalid arguments: ${details || 'Invalid input'}`);
}

function abortIfNeeded(
  signal: AbortSignal
): WorkspaceMcpToolResult | undefined {
  if (signal.aborted) return toolError('Request aborted.');
  return;
}

function defineTool<T extends z.ZodTypeAny>(
  config: ToolExecutorInput<T>
): WorkspaceMcpToolDefinition {
  return {
    name: config.name,
    title: config.title,
    description: config.description,
    inputSchema: config.inputSchema,
    execute: async (args, options) => {
      const aborted = abortIfNeeded(options.signal);
      if (aborted) return aborted;

      const parsed = config.parser.safeParse(args ?? {});
      if (!parsed.success) return toInputError(parsed.error);
      return await config.execute(parsed.data, options);
    },
  };
}

@Injectable()
export class WorkspaceMcpProvider {
  constructor(
    private readonly ac: AccessController,
    private readonly reader: DocReader,
    private readonly writer: DocWriter,
    private readonly storage: PgWorkspaceDocStorageAdapter,
    private readonly context: CopilotContextService,
    private readonly indexer: IndexerService
  ) {}

  async for(userId: string, workspaceId: string): Promise<WorkspaceMcpServer> {
    await this.ac.user(userId).workspace(workspaceId).assert('Workspace.Read');

    const readDocument = defineTool({
      name: 'read_document',
      title: 'Read Document',
      description: 'Read a document with given ID',
      parser: z.object({ docId: z.string() }),
      inputSchema: {
        type: 'object',
        properties: {
          docId: { type: 'string' },
        },
        required: ['docId'],
        additionalProperties: false,
      },
      execute: async ({ docId }, options) => {
        const notFoundError = toolError(`Doc with id ${docId} not found.`);

        const accessible = await this.ac
          .user(userId)
          .workspace(workspaceId)
          .doc(docId)
          .can('Doc.Read');
        if (!accessible) return notFoundError;

        const abortedAfterPermission = abortIfNeeded(options.signal);
        if (abortedAfterPermission) return abortedAfterPermission;

        const content = await this.reader.getDocMarkdown(
          workspaceId,
          docId,
          false
        );
        if (!content) return notFoundError;

        const abortedAfterRead = abortIfNeeded(options.signal);
        if (abortedAfterRead) return abortedAfterRead;

        return toolText(content.markdown);
      },
    });

    const semanticSearch = defineTool({
      name: 'semantic_search',
      title: 'Semantic Search',
      description:
        'Retrieve conceptually related passages by performing vector-based semantic similarity search across embedded documents; use this tool only when exact keyword search fails or the user explicitly needs meaning-level matches (e.g., paraphrases, synonyms, broader concepts, recent documents).',
      parser: z.object({ query: z.string() }),
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string' },
        },
        required: ['query'],
        additionalProperties: false,
      },
      execute: async ({ query }, options) => {
        const trimmed = query.trim();
        if (!trimmed) {
          return toolError('Query is required for semantic search.');
        }

        const chunks = await this.context.matchWorkspaceDocs(
          workspaceId,
          trimmed,
          5,
          options.signal
        );

        const abortedAfterMatch = abortIfNeeded(options.signal);
        if (abortedAfterMatch) return abortedAfterMatch;

        const docs = await this.ac
          .user(userId)
          .workspace(workspaceId)
          .docs(
            chunks.filter(chunk => 'docId' in chunk),
            'Doc.Read'
          );

        const abortedAfterDocs = abortIfNeeded(options.signal);
        if (abortedAfterDocs) return abortedAfterDocs;

        return {
          content: docs.map(doc => ({
            type: 'text',
            text: clearEmbeddingChunk(doc).content,
          })),
        };
      },
    });

    const keywordSearch = defineTool({
      name: 'keyword_search',
      title: 'Keyword Search',
      description:
        'Fuzzy search all workspace documents for the exact keyword or phrase supplied and return passages ranked by textual match. Use this tool by default whenever a straightforward term-based or keyword-base lookup is sufficient.',
      parser: z.object({ query: z.string() }),
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string' },
        },
        required: ['query'],
        additionalProperties: false,
      },
      execute: async ({ query }, options) => {
        const trimmed = query.trim();
        if (!trimmed) return toolError('Query is required for keyword search.');

        let docs = await this.indexer.searchDocsByKeyword(workspaceId, trimmed);

        const abortedAfterSearch = abortIfNeeded(options.signal);
        if (abortedAfterSearch) return abortedAfterSearch;

        docs = await this.ac
          .user(userId)
          .workspace(workspaceId)
          .docs(docs, 'Doc.Read');

        const abortedAfterDocs = abortIfNeeded(options.signal);
        if (abortedAfterDocs) return abortedAfterDocs;

        return {
          content: docs.map(doc => ({
            type: 'text',
            text: JSON.stringify(pick(doc, 'docId', 'title', 'createdAt')),
          })),
        };
      },
    });

    const deleteDocument = defineTool({
      name: 'delete_document',
      title: 'Delete Document',
      description:
        'Move a document to trash (soft delete). The document can be restored from trash within 30 days.',
      parser: z.object({ docId: z.string() }),
      inputSchema: {
        type: 'object',
        properties: { docId: { type: 'string' } },
        required: ['docId'],
        additionalProperties: false,
      },
      execute: async ({ docId }, options) => {
        const accessible = await this.ac
          .user(userId)
          .workspace(workspaceId)
          .doc(docId)
          .can('Doc.Delete');
        if (!accessible)
          return toolError(
            `Doc ${docId} not found or insufficient permissions.`
          );

        const abortedAfterPermission = abortIfNeeded(options.signal);
        if (abortedAfterPermission) return abortedAfterPermission;

        try {
          await this.storage.deleteDoc(workspaceId, docId);
          return toolText(
            JSON.stringify({
              success: true,
              docId,
              message: 'Document moved to trash.',
            })
          );
        } catch (error) {
          return toolError(
            `Failed to delete document: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      },
    });

    const tools = [readDocument, semanticSearch, keywordSearch, deleteDocument];

    if (env.dev || env.namespaces.canary) {
      const createDocument = defineTool({
        name: 'create_document',
        title: 'Create Document',
        description:
          'Create a new document in the workspace with the given title and markdown content. Returns the ID of the created document. This tool not support insert or update database block and image yet.',
        parser: z.object({
          title: z.string().min(1),
          content: z.string(),
        }),
        inputSchema: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: 'The title of the new document',
            },
            content: {
              type: 'string',
              description: 'The markdown content for the document body',
            },
          },
          required: ['title', 'content'],
          additionalProperties: false,
        },
        execute: async ({ title, content }, options) => {
          try {
            await this.ac
              .user(userId)
              .workspace(workspaceId)
              .assert('Workspace.CreateDoc');

            const abortedAfterPermission = abortIfNeeded(options.signal);
            if (abortedAfterPermission) return abortedAfterPermission;

            const sanitizedTitle = title.replace(/[\r\n]+/g, ' ').trim();
            if (!sanitizedTitle) throw new Error('Title cannot be empty');
            const strippedContent = content.replace(
              /^[ \t]{0,3}#\s+[^\n]*#*\s*\n*/,
              ''
            );
            const result = await this.writer.createDoc(
              workspaceId,
              sanitizedTitle,
              strippedContent,
              userId
            );

            return toolText(
              JSON.stringify({
                success: true,
                docId: result.docId,
                message: `Document "${title}" created successfully`,
              })
            );
          } catch (error) {
            return toolError(
              `Failed to create document: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
          }
        },
      });

      const updateDocument = defineTool({
        name: 'update_document',
        title: 'Update Document',
        description:
          'Update an existing document with new markdown content (body only). Uses structural diffing to apply minimal changes, preserving document history and enabling real-time collaboration. This does NOT update the document title. This tool not support insert or update database block and image yet.',
        parser: z.object({
          docId: z.string(),
          content: z.string(),
        }),
        inputSchema: {
          type: 'object',
          properties: {
            docId: {
              type: 'string',
              description: 'The ID of the document to update',
            },
            content: {
              type: 'string',
              description:
                'The complete new markdown content for the document body (do NOT include a title H1)',
            },
          },
          required: ['docId', 'content'],
          additionalProperties: false,
        },
        execute: async ({ docId, content }, options) => {
          const notFoundError = toolError(`Doc with id ${docId} not found.`);

          const accessible = await this.ac
            .user(userId)
            .workspace(workspaceId)
            .doc(docId)
            .can('Doc.Update');
          if (!accessible) return notFoundError;

          const abortedBeforeWrite = abortIfNeeded(options.signal);
          if (abortedBeforeWrite) return abortedBeforeWrite;

          try {
            await this.writer.updateDoc(workspaceId, docId, content, userId);
            return toolText(
              JSON.stringify({
                success: true,
                docId,
                message: 'Document updated successfully',
              })
            );
          } catch (error) {
            return toolError(
              `Failed to update document: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
          }
        },
      });

      const updateDocumentMeta = defineTool({
        name: 'update_document_meta',
        title: 'Update Document Metadata',
        description: 'Update document metadata (currently title only).',
        parser: z.object({
          docId: z.string(),
          title: z.string().min(1),
        }),
        inputSchema: {
          type: 'object',
          properties: {
            docId: {
              type: 'string',
              description: 'The ID of the document to update',
            },
            title: {
              type: 'string',
              description: 'The new document title',
            },
          },
          required: ['docId', 'title'],
          additionalProperties: false,
        },
        execute: async ({ docId, title }, options) => {
          const notFoundError = toolError(`Doc with id ${docId} not found.`);

          const accessible = await this.ac
            .user(userId)
            .workspace(workspaceId)
            .doc(docId)
            .can('Doc.Update');
          if (!accessible) return notFoundError;

          const abortedAfterPermission = abortIfNeeded(options.signal);
          if (abortedAfterPermission) return abortedAfterPermission;

          try {
            const sanitizedTitle = title.replace(/[\r\n]+/g, ' ').trim();
            if (!sanitizedTitle) throw new Error('Title cannot be empty');

            await this.writer.updateDocMeta(
              workspaceId,
              docId,
              { title: sanitizedTitle },
              userId
            );

            return toolText(
              JSON.stringify({
                success: true,
                docId,
                message: 'Document title updated successfully',
              })
            );
          } catch (error) {
            return toolError(
              `Failed to update document metadata: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
          }
        },
      });

      const listDatabases = defineTool({
        name: 'list_databases',
        title: 'List Databases',
        description:
          'List all database (table/kanban/calendar) blocks in the workspace. Returns docId, database block id, title, and view names for each database found.',
        parser: z.object({
          limit: z.number().int().min(1).max(100).optional().default(50),
        }),
        inputSchema: {
          type: 'object',
          properties: {
            limit: { type: 'number', minimum: 1, maximum: 100, default: 50 },
          },
          additionalProperties: false,
        },
        execute: async ({ limit }, options) => {
          const aborted = abortIfNeeded(options.signal);
          if (aborted) return aborted;

          try {
            // Search the block index for affine:database blocks in this workspace
            const result = await this.indexer.search({
              table: SearchTable.block,
              query: {
                type: SearchQueryType.boolean,
                occur: SearchQueryOccur.must,
                queries: [
                  {
                    type: SearchQueryType.match,
                    field: 'workspaceId',
                    match: workspaceId,
                  },
                  {
                    type: SearchQueryType.match,
                    field: 'flavour',
                    match: 'affine:database',
                  },
                ],
              },
              options: {
                fields: ['docId', 'blockId', 'content', 'additional'],
                pagination: { limit },
              },
            });

            const abortedAfterSearch = abortIfNeeded(options.signal);
            if (abortedAfterSearch) return abortedAfterSearch;

            // Filter by doc read permissions
            const accessibleDocs = await this.ac
              .user(userId)
              .workspace(workspaceId)
              .docs(
                result.nodes.map(n => ({
                  docId: n.fields.docId?.[0] as string,
                })),
                'Doc.Read'
              );
            const accessibleDocIds = new Set(
              accessibleDocs.map(d => d.docId)
            );

            const databases = result.nodes
              .filter(n => {
                const docId = n.fields.docId?.[0] as string | undefined;
                return docId && accessibleDocIds.has(docId);
              })
              .map(n => {
                const docId = n.fields.docId?.[0] as string;
                const blockId = n.fields.blockId?.[0] as string;
                const content = (n.fields.content?.[0] as string) ?? '';
                let additional: Record<string, unknown> = {};
                try {
                  const raw = n.fields.additional?.[0] as string | undefined;
                  if (raw) additional = JSON.parse(raw) as Record<string, unknown>;
                } catch {
                  // ignore parse errors
                }
                return { docId, blockId, title: content, additional };
              });

            return toolText(
              JSON.stringify({ databases, total: databases.length })
            );
          } catch (error) {
            return toolError(
              `Failed to list databases: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
          }
        },
      });

      const queryDatabase = defineTool({
        name: 'query_database',
        title: 'Query Database',
        description:
          'Query rows from a specific database block. Returns the document markdown content scoped to the database section.',
        parser: z.object({
          docId: z.string(),
          databaseId: z.string().optional(),
          limit: z.number().int().min(1).max(200).optional().default(50),
          offset: z.number().int().min(0).optional().default(0),
        }),
        inputSchema: {
          type: 'object',
          properties: {
            docId: { type: 'string' },
            databaseId: { type: 'string' },
            limit: { type: 'number', default: 50 },
            offset: { type: 'number', default: 0 },
          },
          required: ['docId'],
          additionalProperties: false,
        },
        execute: async ({ docId, databaseId, limit, offset }, options) => {
          const accessible = await this.ac
            .user(userId)
            .workspace(workspaceId)
            .doc(docId)
            .can('Doc.Read');
          if (!accessible)
            return toolError(`Doc ${docId} not found or not accessible.`);

          const abortedAfterPermission = abortIfNeeded(options.signal);
          if (abortedAfterPermission) return abortedAfterPermission;

          try {
            // Read the doc's markdown — this is the best available representation
            // since direct CRDT parsing of database rows requires the native layer
            const content = await this.reader.getDocMarkdown(
              workspaceId,
              docId,
              false
            );
            if (!content) {
              return toolError(`Doc ${docId} not found.`);
            }

            const abortedAfterRead = abortIfNeeded(options.signal);
            if (abortedAfterRead) return abortedAfterRead;

            return toolText(
              JSON.stringify({
                docId,
                databaseId: databaseId ?? null,
                limit,
                offset,
                content: content.markdown,
                note: 'Database rows are represented as markdown table(s) within the document content.',
              })
            );
          } catch (error) {
            return toolError(
              `Failed to query database: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
          }
        },
      });

      tools.push(createDocument, updateDocument, updateDocumentMeta, listDatabases, queryDatabase);
    }

    return {
      name: `AFFiNE MCP Server for Workspace ${workspaceId}`,
      version: '1.0.1',
      tools,
    };
  }
}
