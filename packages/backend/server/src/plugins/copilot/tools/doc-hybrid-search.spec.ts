import test from 'ava';

import type { DocChunkSimilarity, FileChunkSimilarity } from '../../../models';
import { mergeHybridSearchResults } from './doc-hybrid-search.js';

test('mergeHybridSearchResults__given_keyword_and_semantic_same_doc__then_fuses_rank_and_citation', t => {
  const results = mergeHybridSearchResults({
    keywordDocs: [
      {
        docId: 'doc-a',
        blockId: 'block-a',
        title: 'Launch Plan',
        highlight: '<b>launch</b> milestones',
        createdAt: new Date('2026-05-01T00:00:00Z'),
        updatedAt: new Date('2026-05-02T00:00:00Z'),
        createdByUserId: 'user-a',
        updatedByUserId: 'user-a',
      },
    ],
    semanticChunks: [
      {
        docId: 'doc-a',
        chunk: 2,
        content: 'The Manut launch plan covers citations and search.',
        distance: 0.12,
      } as DocChunkSimilarity,
      {
        fileId: 'file-a',
        blobId: 'blob-a',
        name: 'launch-notes.pdf',
        mimeType: 'application/pdf',
        chunk: 0,
        content: 'External launch notes.',
        distance: 0.2,
      } as FileChunkSimilarity,
    ],
  });

  t.is(results.length, 2);
  t.like(results[0], {
    sourceType: 'doc',
    sourceId: 'doc-a',
    title: 'Launch Plan',
    matchedBy: ['keyword', 'semantic'],
    citation: {
      sourceType: 'doc',
      docId: 'doc-a',
      blockId: 'block-a',
      label: '[^source-1]',
      snippet: 'The Manut launch plan covers citations and search.',
    },
  });
  t.true(results[0].score > results[1].score);
});

test('mergeHybridSearchResults__given_limit__then_returns_top_ranked_results', t => {
  const results = mergeHybridSearchResults({
    keywordDocs: [
      {
        docId: 'doc-keyword',
        blockId: 'block-keyword',
        title: 'Keyword Hit',
        highlight: 'exact phrase',
        createdAt: new Date('2026-05-01T00:00:00Z'),
        updatedAt: new Date('2026-05-02T00:00:00Z'),
        createdByUserId: 'user-a',
        updatedByUserId: 'user-a',
      },
    ],
    semanticChunks: [
      {
        docId: 'doc-semantic',
        chunk: 0,
        content: 'semantic hit',
        distance: 0.1,
      } as DocChunkSimilarity,
    ],
    limit: 1,
  });

  t.is(results.length, 1);
  t.is(results[0].sourceId, 'doc-keyword');
});
