/**
 * @vitest-environment happy-dom
 */
import { html, render } from 'lit';
import { describe, expect, test } from 'vitest';

import { ChatMessageAssistant } from './assistant';

describe('ChatMessageAssistant loading state', () => {
  test('ChatMessageAssistant > given transmitting reply has no content yet > renders loading state', () => {
    const container = document.createElement('div');
    const assistant = {
      isLast: true,
      status: 'transmitting',
      item: {
        id: 'message-1',
        role: 'assistant',
        content: '',
        createdAt: new Date(0).toISOString(),
      },
      renderHeader: () => html``,
      renderContent: () => html``,
    } as unknown as ChatMessageAssistant;

    render(
      (ChatMessageAssistant.prototype as any).render.call(assistant),
      container
    );

    expect(container.querySelector('ai-loading')).not.toBeNull();
  });
});
