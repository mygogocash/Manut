import { WithDisposable } from '@blocksuite/affine/global/lit';
import { ShadowlessElement } from '@blocksuite/affine/std';
import { css, html, nothing } from 'lit';
import { property } from 'lit/decorators.js';

import { type ChatMessage } from '../../components/ai-chat-messages';

export class ChatMessageUser extends WithDisposable(ShadowlessElement) {
  static override styles = css`
    chat-message-user {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
    }

    /* Manut v1.12 chat redesign: glass bubble surface for user messages.
       Wraps the entire user content stack (image attachments + text body).
       A 2px accent-violet left border distinguishes user messages from
       assistant messages (accent-blue). */
    .chat-message-user {
      display: flex;
      flex-direction: column;
      max-width: calc(100% - 58px);
      background-color: var(--manut-surface-glass);
      backdrop-filter: blur(20px) saturate(180%);
      -webkit-backdrop-filter: blur(20px) saturate(180%);
      border-radius: var(--manut-radius-card);
      border-left: 2px solid var(--manut-accent-violet-border);
      padding: 12px 14px;
      box-sizing: border-box;
    }

    /* Solid fallback for browsers without backdrop-filter support. */
    @supports (not (backdrop-filter: blur(20px))) and
      (not (-webkit-backdrop-filter: blur(20px))) {
      .chat-message-user {
        background-color: var(--affine-background-overlay-panel-color);
      }
    }

    .chat-content-images {
      display: flex;
      justify-content: flex-end;

      .images-row {
        margin-left: auto;
      }
    }

    .text-content-wrapper {
      align-self: flex-end;
    }
  `;

  @property({ attribute: false })
  accessor item!: ChatMessage;

  @property({ attribute: 'data-testid', reflect: true })
  accessor testId = 'chat-message-user';

  renderContent() {
    const { item } = this;

    return html`
      ${item.attachments
        ? html`<chat-content-images
            class="chat-content-images"
            .images=${item.attachments}
          ></chat-content-images>`
        : nothing}
      <div
        class="text-content-wrapper"
        data-test-id="chat-content-user-text"
        style="max-width: 100%;"
      >
        <chat-content-pure-text .text=${item.content}></chat-content-pure-text>
      </div>
    `;
  }

  protected override render() {
    return html` <div class="chat-message-user">${this.renderContent()}</div> `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'chat-message-user': ChatMessageUser;
  }
}
