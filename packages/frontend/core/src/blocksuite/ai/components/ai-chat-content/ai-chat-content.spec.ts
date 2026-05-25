/**
 * @vitest-environment happy-dom
 */
import { describe, expect, test, vi } from 'vitest';

import { AIChatContent, getChatPanelMainClasses } from './ai-chat-content';

describe('AIChatContent empty layout', () => {
  test('getChatPanelMainClasses > given floating empty chat > then enables independent no-message layout', () => {
    expect(
      getChatPanelMainClasses({
        independentMode: true,
        hasMessages: false,
      })
    ).toEqual({
      'chat-panel-main': true,
      'independent-mode': true,
      'no-message': true,
    });
  });

  test('getChatPanelMainClasses > given chat has messages > then keeps transcript layout', () => {
    expect(
      getChatPanelMainClasses({
        independentMode: true,
        hasMessages: true,
      })
    ).toEqual({
      'chat-panel-main': true,
      'independent-mode': true,
      'no-message': false,
    });
  });
});

describe('AIChatContent pinned scroll tracking', () => {
  test('records scroll position from the chat messages host', async () => {
    let scrollEndHandler: (() => void) | undefined;

    const chatMessages = {
      scrollTop: 256,
      updateComplete: Promise.resolve(),
      addEventListener: vi.fn((event: string, handler: EventListener) => {
        if (event === 'scrollend') {
          scrollEndHandler = handler as () => void;
        }
      }),
    };

    const content = {
      chatMessagesRef: { value: chatMessages },
      _scrollListenersInitialized: false,
      lastScrollTop: undefined,
    } as unknown as AIChatContent;

    (AIChatContent.prototype as any)._initializeScrollListeners.call(content);
    await chatMessages.updateComplete;
    await Promise.resolve();

    expect(chatMessages.addEventListener).toHaveBeenCalledWith(
      'scrollend',
      expect.any(Function)
    );

    scrollEndHandler?.();

    expect((content as any).lastScrollTop).toBe(256);
  });
});
