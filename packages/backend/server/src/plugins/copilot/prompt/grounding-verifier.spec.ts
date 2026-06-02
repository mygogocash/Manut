import test from 'ava';

import { verifyWorkspaceGrounding } from './grounding-verifier.js';

test('verifyWorkspaceGrounding__given_no_workspace_sources__then_skips', t => {
  const result = verifyWorkspaceGrounding({
    content: 'General answer without retrieval.',
    streamObjects: [],
  });

  t.like(result, {
    status: 'skipped',
    sourceCount: 0,
  });
});

test('verifyWorkspaceGrounding__given_hybrid_sources_and_matching_citation__then_passes', t => {
  const result = verifyWorkspaceGrounding({
    content:
      'The launch plan includes source citations.[^1]\n\n[^1]:{"type":"doc","docId":"doc-a"}',
    streamObjects: [
      {
        type: 'tool-result',
        toolCallId: 'tool-1',
        toolName: 'doc_hybrid_search',
        args: { query: 'launch plan' },
        result: [
          {
            sourceType: 'doc',
            docId: 'doc-a',
            citation: {
              sourceType: 'doc',
              docId: 'doc-a',
              label: '[^source-1]',
            },
          },
        ],
      },
    ],
  });

  t.like(result, {
    status: 'pass',
    sourceCount: 1,
  });
});

test('verifyWorkspaceGrounding__given_sources_without_citations__then_warns', t => {
  const result = verifyWorkspaceGrounding({
    content: 'The launch plan includes source citations.',
    streamObjects: [
      {
        type: 'tool-result',
        toolCallId: 'tool-1',
        toolName: 'doc_keyword_search',
        args: { query: 'launch plan' },
        result: [{ docId: 'doc-a', title: 'Launch Plan' }],
      },
    ],
  });

  t.is(result.status, 'warn');
  t.true(result.warnings.includes('missing-inline-citations'));
  t.true(result.warnings.includes('missing-reference-list'));
});

test('verifyWorkspaceGrounding__given_citation_not_in_sources__then_warns', t => {
  const result = verifyWorkspaceGrounding({
    content:
      'The launch plan includes source citations.[^1]\n\n[^1]:{"type":"doc","docId":"doc-b"}',
    streamObjects: [
      {
        type: 'tool-result',
        toolCallId: 'tool-1',
        toolName: 'doc_hybrid_search',
        args: { query: 'launch plan' },
        result: [
          {
            sourceType: 'doc',
            docId: 'doc-a',
            citation: {
              sourceType: 'doc',
              docId: 'doc-a',
              label: '[^source-1]',
            },
          },
        ],
      },
    ],
  });

  t.is(result.status, 'warn');
  t.deepEqual(result.unsupportedCitations, ['doc:doc-b']);
});
