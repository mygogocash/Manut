import { describe, expect, test } from 'vitest';

import {
  extractAgentPlanSteps,
  summarizeAssistantStatusChips,
  summarizeAssistantTimelineItems,
} from './assistant-status';

describe('summarizeAssistantStatusChips', () => {
  test('given no stream objects > returns no chips', () => {
    expect(summarizeAssistantStatusChips(undefined)).toEqual([]);
  });

  test('given a source tool result > returns source and tool chips', () => {
    expect(
      summarizeAssistantStatusChips([
        {
          type: 'tool-result',
          toolCallId: 'tool-1',
          toolName: 'docSemanticSearch',
          args: {},
          result: { chunks: [] },
        },
      ])
    ).toEqual([
      {
        kind: 'tools',
        label: 'Used 1 tool',
        testId: 'ai-tool-status-chip',
      },
      {
        kind: 'sources',
        label: 'Checked 1 source',
        testId: 'ai-source-status-chip',
      },
    ]);
  });

  test('given a hybrid search tool result > returns source and tool chips', () => {
    expect(
      summarizeAssistantStatusChips([
        {
          type: 'tool-result',
          toolCallId: 'tool-1',
          toolName: 'docHybridSearch',
          args: {},
          result: { results: [] },
        },
      ]).some(chip => chip.kind === 'sources')
    ).toBe(true);
  });

  test('given a camelCase write tool result > returns changes chip', () => {
    expect(
      summarizeAssistantStatusChips([
        {
          type: 'tool-result',
          toolCallId: 'tool-1',
          toolName: 'docEdit',
          args: {},
          result: { ok: true },
        },
      ]).some(chip => chip.kind === 'writes')
    ).toBe(true);
  });

  test('given a legacy snake_case write tool call > returns changes chip', () => {
    expect(
      summarizeAssistantStatusChips([
        {
          type: 'tool-call',
          toolCallId: 'tool-1',
          toolName: 'doc_edit',
          args: {},
        },
      ]).some(chip => chip.kind === 'writes')
    ).toBe(true);
  });

  test('given a failed tool result > returns failure chip', () => {
    expect(
      summarizeAssistantStatusChips([
        {
          type: 'tool-result',
          toolCallId: 'tool-1',
          toolName: 'webSearch',
          args: {},
          result: { type: 'error', name: 'NetworkError' },
        },
      ]).some(chip => chip.kind === 'failures')
    ).toBe(true);
  });

  test('given an awaiting approval tool result > returns approval chip', () => {
    expect(
      summarizeAssistantStatusChips([
        {
          type: 'tool-result',
          toolCallId: 'tool-1',
          toolName: 'docUpdate',
          args: {},
          result: {
            type: 'awaiting-approval',
            approvalId: 'approval-1',
          },
        },
      ]).some(chip => chip.kind === 'approvals')
    ).toBe(true);
  });
});

describe('summarizeAssistantTimelineItems', () => {
  test('given source, write, approval, and failed tools > returns visible execution states', () => {
    expect(
      summarizeAssistantTimelineItems([
        {
          type: 'tool-call',
          toolCallId: 'search-1',
          toolName: 'docHybridSearch',
          args: { query: 'launch plan' },
        },
        {
          type: 'tool-result',
          toolCallId: 'search-1',
          toolName: 'docHybridSearch',
          args: { query: 'launch plan' },
          result: { results: [{ docId: 'doc-1' }] },
        },
        {
          type: 'tool-call',
          toolCallId: 'write-1',
          toolName: 'docUpdate',
          args: { docId: 'doc-2' },
        },
        {
          type: 'tool-result',
          toolCallId: 'write-1',
          toolName: 'docUpdate',
          args: { docId: 'doc-2' },
          result: {
            type: 'awaiting-approval',
            approvalId: 'approval-1',
          },
        },
        {
          type: 'tool-result',
          toolCallId: 'web-1',
          toolName: 'webSearch',
          args: {},
          result: { type: 'error', message: 'network failed' },
        },
      ])
    ).toEqual([
      {
        id: 'search-1',
        kind: 'search',
        label: 'Searched workspace',
        detail: 'launch plan',
        status: 'completed',
      },
      {
        id: 'write-1',
        kind: 'write',
        label: 'Preparing write',
        detail: 'approval-1',
        status: 'awaiting-approval',
      },
      {
        id: 'web-1',
        kind: 'search',
        label: 'Searched web',
        detail: 'network failed',
        status: 'failed',
      },
    ]);
  });

  test('given a pending compose tool call > returns drafting state', () => {
    expect(
      summarizeAssistantTimelineItems([
        {
          type: 'tool-call',
          toolCallId: 'compose-1',
          toolName: 'docCompose',
          args: { title: 'Proposal' },
        },
      ])
    ).toEqual([
      {
        id: 'compose-1',
        kind: 'generate',
        label: 'Drafting doc',
        detail: 'Proposal',
        status: 'running',
      },
    ]);
  });
});

describe('extractAgentPlanSteps', () => {
  test('given a short agent plan block > returns normalized steps', () => {
    expect(
      extractAgentPlanSteps(
        'Plan:\n1. Search workspace notes.\n2. Draft a proposal.\n3. Save it as a doc.\n\nI will start now.'
      )
    ).toEqual([
      'Search workspace notes.',
      'Draft a proposal.',
      'Save it as a doc.',
    ]);
  });

  test('given plain answer content > returns no plan steps', () => {
    expect(extractAgentPlanSteps('Here is the summary you asked for.')).toEqual(
      []
    );
  });
});
