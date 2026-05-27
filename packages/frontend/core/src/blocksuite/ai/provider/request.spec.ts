/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, test, vi } from 'vitest';

import type { CopilotClient } from './copilot-client';
import type * as EventSourceModule from './event-source';
import { textToText } from './request';

const mocks = vi.hoisted(() => ({
  chatWebSocketStream: vi.fn(),
  toTextStream: vi.fn(),
}));

vi.mock('./event-source', async importOriginal => {
  const actual = await importOriginal<typeof EventSourceModule>();
  return {
    ...actual,
    toTextStream: mocks.toTextStream,
  };
});

vi.mock('./ws-transport', () => ({
  chatWebSocketStream: mocks.chatWebSocketStream,
}));

describe('AI chat transport', () => {
  afterEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  test('AI chat transport > given stale ws_transport flag > uses SSE response stream', async () => {
    localStorage.setItem('global-state:affine-flag:ws_transport', 'true');

    const eventSource = { close: vi.fn() };
    const client = {
      createMessage: vi.fn().mockResolvedValue('message-1'),
      chatTextStream: vi.fn().mockReturnValue(eventSource),
    };

    mocks.toTextStream.mockReturnValue(
      (async function* () {
        yield {
          type: 'message',
          data: JSON.stringify({
            type: 'text-delta',
            textDelta: 'hello from SSE',
          }),
        };
      })()
    );

    const result = await textToText({
      client: client as unknown as CopilotClient,
      sessionId: 'session-1',
      content: 'hello',
      stream: false,
    });

    expect(result).toBe('hello from SSE');
    expect(client.createMessage).toHaveBeenCalledWith(
      {
        sessionId: 'session-1',
        content: 'hello',
        params: undefined,
      },
      { timeout: 50000, signal: undefined }
    );
    expect(client.chatTextStream).toHaveBeenCalledWith(
      {
        sessionId: 'session-1',
        messageId: 'message-1',
        reasoning: undefined,
        modelId: undefined,
        toolsConfig: undefined,
      },
      'stream-object'
    );
    expect(mocks.chatWebSocketStream).not.toHaveBeenCalled();
    expect(eventSource.close).toHaveBeenCalled();
  });
});
