import { z } from 'zod';

import type {
  BlobChunkSimilarity,
  ChunkSimilarity,
  DocChunkSimilarity,
  FileChunkSimilarity,
} from '../../../models';
import type { SearchDoc } from '../../indexer';
import { type ToolError, toolError } from './error';
import { defineTool } from './tool';

type SearchChannel = 'keyword' | 'semantic';

export type HybridSearchSourceType = 'doc' | 'file' | 'blob';

export type HybridSearchCitation =
  | {
      sourceType: 'doc';
      docId: string;
      blockId?: string;
      label: string;
      snippet?: string;
    }
  | {
      sourceType: 'attachment';
      blobId: string;
      fileName: string;
      fileType: string;
      label: string;
      snippet?: string;
    };

export type HybridSearchResult = {
  sourceType: HybridSearchSourceType;
  sourceId: string;
  score: number;
  rank: number;
  matchedBy: SearchChannel[];
  citation: HybridSearchCitation;
  docId?: string;
  fileId?: string;
  blobId?: string;
  blockId?: string;
  title?: string;
  content?: string;
  snippet?: string;
  highlight?: string;
  createdAt?: Date;
  updatedAt?: Date;
  createdByUser?: SearchDoc['createdByUser'];
  updatedByUser?: SearchDoc['updatedByUser'];
  name?: string;
  mimeType?: string;
};

type PendingHybridCitation = HybridSearchCitation extends infer Citation
  ? Citation extends unknown
    ? Omit<Citation, 'label'>
    : never
  : never;

type PendingHybridResult = Omit<HybridSearchResult, 'citation' | 'rank'> & {
  bestRank: number;
  firstSeen: number;
  citation: PendingHybridCitation;
};

export type MergeHybridSearchInput = {
  keywordDocs: SearchDoc[];
  semanticChunks: ChunkSimilarity[];
  limit?: number;
};

const DEFAULT_LIMIT = 8;
const RRF_K = 60;

function isDocChunk(chunk: ChunkSimilarity): chunk is DocChunkSimilarity {
  return (
    'docId' in chunk && typeof (chunk as { docId?: unknown }).docId === 'string'
  );
}

function isFileChunk(chunk: ChunkSimilarity): chunk is FileChunkSimilarity {
  return (
    'fileId' in chunk &&
    typeof (chunk as { fileId?: unknown }).fileId === 'string' &&
    'blobId' in chunk &&
    typeof (chunk as { blobId?: unknown }).blobId === 'string'
  );
}

function isBlobChunk(chunk: ChunkSimilarity): chunk is BlobChunkSimilarity {
  return (
    'blobId' in chunk &&
    typeof (chunk as { blobId?: unknown }).blobId === 'string'
  );
}

function compactText(text?: string) {
  return text
    ?.replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function snippet(text?: string) {
  const clean = compactText(text);
  if (!clean) return undefined;
  return clean.length > 280 ? `${clean.slice(0, 277)}...` : clean;
}

function rrfScore(rank: number) {
  return 1 / (RRF_K + rank + 1);
}

function addChannel(result: PendingHybridResult, channel: SearchChannel) {
  if (!result.matchedBy.includes(channel)) {
    result.matchedBy.push(channel);
  }
}

function createDocResult(doc: SearchDoc, rank: number, firstSeen: number) {
  const result: PendingHybridResult = {
    sourceType: 'doc',
    sourceId: doc.docId,
    score: 0,
    bestRank: rank,
    firstSeen,
    matchedBy: [],
    docId: doc.docId,
    blockId: doc.blockId,
    title: doc.title,
    highlight: doc.highlight,
    snippet: snippet(doc.highlight),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    createdByUser: doc.createdByUser,
    updatedByUser: doc.updatedByUser,
    citation: {
      sourceType: 'doc',
      docId: doc.docId,
      blockId: doc.blockId,
      snippet: snippet(doc.highlight),
    },
  };
  return result;
}

function getString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === 'string' ? value : undefined;
}

function updateWithSemanticChunk(
  result: PendingHybridResult,
  chunk: ChunkSimilarity
) {
  const record = chunk as unknown as Record<string, unknown>;
  result.content ??= chunk.content;
  result.snippet = snippet(chunk.content) ?? result.snippet;
  result.title ??= getString(record, 'title');
  result.createdAt ??= record.createdAt as Date | undefined;
  result.updatedAt ??= record.updatedAt as Date | undefined;
  result.createdByUser ??= record.createdByUser as SearchDoc['createdByUser'];
  result.updatedByUser ??= record.updatedByUser as SearchDoc['updatedByUser'];
  result.citation.snippet = snippet(chunk.content) ?? result.citation.snippet;
}

function createSemanticResult(
  chunk: ChunkSimilarity,
  rank: number,
  firstSeen: number
): PendingHybridResult {
  const record = chunk as unknown as Record<string, unknown>;
  if (isDocChunk(chunk)) {
    return {
      sourceType: 'doc',
      sourceId: chunk.docId,
      score: 0,
      bestRank: rank,
      firstSeen,
      matchedBy: [],
      docId: chunk.docId,
      title: getString(record, 'title'),
      content: chunk.content,
      snippet: snippet(chunk.content),
      createdAt: record.createdAt as Date | undefined,
      updatedAt: record.updatedAt as Date | undefined,
      createdByUser: record.createdByUser as SearchDoc['createdByUser'],
      updatedByUser: record.updatedByUser as SearchDoc['updatedByUser'],
      citation: {
        sourceType: 'doc',
        docId: chunk.docId,
        snippet: snippet(chunk.content),
      },
    };
  }

  if (isFileChunk(chunk)) {
    return {
      sourceType: 'file',
      sourceId: chunk.fileId,
      score: 0,
      bestRank: rank,
      firstSeen,
      matchedBy: [],
      fileId: chunk.fileId,
      blobId: chunk.blobId,
      name: chunk.name,
      mimeType: chunk.mimeType,
      title: chunk.name,
      content: chunk.content,
      snippet: snippet(chunk.content),
      citation: {
        sourceType: 'attachment',
        blobId: chunk.blobId,
        fileName: chunk.name,
        fileType: chunk.mimeType,
        snippet: snippet(chunk.content),
      },
    };
  }

  if (isBlobChunk(chunk)) {
    const blobName = getString(record, 'name') ?? chunk.blobId;
    const mimeType =
      getString(record, 'mimeType') ?? 'application/octet-stream';
    return {
      sourceType: 'blob',
      sourceId: chunk.blobId,
      score: 0,
      bestRank: rank,
      firstSeen,
      matchedBy: [],
      blobId: chunk.blobId,
      name: blobName,
      mimeType,
      title: blobName,
      content: chunk.content,
      snippet: snippet(chunk.content),
      citation: {
        sourceType: 'attachment',
        blobId: chunk.blobId,
        fileName: blobName,
        fileType: mimeType,
        snippet: snippet(chunk.content),
      },
    };
  }

  return {
    sourceType: 'blob',
    sourceId: `chunk-${firstSeen}`,
    score: 0,
    bestRank: rank,
    firstSeen,
    matchedBy: [],
    content: chunk.content,
    snippet: snippet(chunk.content),
    citation: {
      sourceType: 'attachment',
      blobId: `chunk-${firstSeen}`,
      fileName: 'Workspace search result',
      fileType: 'text/plain',
      snippet: snippet(chunk.content),
    },
  };
}

function sourceKeyForChunk(chunk: ChunkSimilarity, index: number) {
  if (isDocChunk(chunk)) return `doc:${chunk.docId}`;
  if (isFileChunk(chunk)) return `file:${chunk.fileId}`;
  if (isBlobChunk(chunk)) return `blob:${chunk.blobId}`;
  return `chunk:${index}`;
}

export function mergeHybridSearchResults({
  keywordDocs,
  semanticChunks,
  limit = DEFAULT_LIMIT,
}: MergeHybridSearchInput): HybridSearchResult[] {
  const merged = new Map<string, PendingHybridResult>();
  const scoredChannels = new Set<string>();
  let firstSeen = 0;

  keywordDocs.forEach((doc, index) => {
    const key = `doc:${doc.docId}`;
    const result = merged.get(key) ?? createDocResult(doc, index, firstSeen++);
    result.bestRank = Math.min(result.bestRank, index);
    addChannel(result, 'keyword');
    const channelKey = `${key}:keyword`;
    if (!scoredChannels.has(channelKey)) {
      result.score += rrfScore(index);
      scoredChannels.add(channelKey);
    }
    merged.set(key, result);
  });

  semanticChunks.forEach((chunk, index) => {
    const key = sourceKeyForChunk(chunk, index);
    const result =
      merged.get(key) ?? createSemanticResult(chunk, index, firstSeen++);
    result.bestRank = Math.min(result.bestRank, index);
    updateWithSemanticChunk(result, chunk);
    addChannel(result, 'semantic');
    const channelKey = `${key}:semantic`;
    if (!scoredChannels.has(channelKey)) {
      result.score += rrfScore(index);
      scoredChannels.add(channelKey);
    }
    merged.set(key, result);
  });

  return Array.from(merged.values())
    .sort((a, b) => {
      return (
        b.score - a.score ||
        a.bestRank - b.bestRank ||
        a.firstSeen - b.firstSeen
      );
    })
    .slice(0, Math.max(1, limit))
    .map((result, index) => {
      const { bestRank: _bestRank, firstSeen: _, ...rest } = result;
      return {
        ...rest,
        rank: index + 1,
        citation: {
          ...rest.citation,
          label: `[^source-${index + 1}]`,
        } as HybridSearchCitation,
      };
    });
}

export const createDocHybridSearchTool = (
  searchDocs: (
    query: string,
    signal?: AbortSignal
  ) => Promise<{
    keywordDocs: SearchDoc[] | ToolError;
    semanticChunks: ChunkSimilarity[] | ToolError;
  }>
) => {
  return defineTool({
    description:
      'Search workspace knowledge with hybrid retrieval by combining exact keyword matches and semantic vector matches, then return fused, citation-ready sources. Use this before answering workspace-grounded questions, especially when the user asks about documents, notes, people, projects, decisions, or anything likely stored in the workspace.',
    inputSchema: z.object({
      query: z
        .string()
        .describe(
          'The complete user question or search phrase to retrieve workspace sources for.'
        ),
      limit: z
        .number()
        .int()
        .min(1)
        .max(12)
        .optional()
        .describe('Maximum number of fused sources to return. Defaults to 8.'),
    }),
    execute: async ({ query, limit }, options) => {
      try {
        const { keywordDocs, semanticChunks } = await searchDocs(
          query,
          options.signal
        );
        const keywordFailed = !Array.isArray(keywordDocs);
        const semanticFailed = !Array.isArray(semanticChunks);
        if (keywordFailed && semanticFailed) {
          return toolError(
            'Doc Hybrid Search Failed',
            `${keywordDocs.message} ${semanticChunks.message}`.trim()
          );
        }
        return mergeHybridSearchResults({
          keywordDocs: keywordFailed ? [] : keywordDocs,
          semanticChunks: semanticFailed ? [] : semanticChunks,
          limit,
        });
      } catch (e: any) {
        return toolError('Doc Hybrid Search Failed', e.message);
      }
    },
  });
};
