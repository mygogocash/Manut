import { describe, expect, test } from 'vitest';

import { summarizeAssistantStatusChips } from './assistant-status';

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
});
