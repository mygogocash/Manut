import type { FeatureFlagService } from '@affine/core/modules/feature-flag';
import type { PeekViewService } from '@affine/core/modules/peek-view';
import type { AppThemeService } from '@affine/core/modules/theme';
import type { CopilotChatHistoryFragment } from '@affine/graphql';
import { I18n } from '@affine/i18n';
import { WithDisposable } from '@blocksuite/affine/global/lit';
import { isInsidePageEditor } from '@blocksuite/affine/shared/utils';
import {
  type BlockStdScope,
  type EditorHost,
  ShadowlessElement,
} from '@blocksuite/affine/std';
import type { ExtensionType } from '@blocksuite/affine/store';
import type { NotificationService } from '@blocksuite/affine-shared/services';
import type { Signal } from '@preact/signals-core';
import { css, html, nothing } from 'lit';
import { property } from 'lit/decorators.js';

import {
  EdgelessEditorActions,
  PageEditorActions,
} from '../../_common/chat-actions-handle';
import type { DocDisplayConfig } from '../../components/ai-chat-chips';
import {
  type ChatMessage,
  type ChatStatus,
  isChatMessage,
  type StreamObject,
} from '../../components/ai-chat-messages';
import { AIChatErrorRenderer } from '../../messages/error';
import { type AIError } from '../../provider';
import { mergeStreamContent } from '../../utils/stream-objects';

export class ChatMessageAssistant extends WithDisposable(ShadowlessElement) {
  static override styles = css`
    .message-info {
      color: var(--affine-placeholder-color);
      font-size: var(--affine-font-xs);
      font-weight: 400;
    }
    /* ε-AI-INTEL v1.10: chip surfaced when the assistant's stream contains
       a tool-call for a write tool. Lets the user see at-a-glance that AI
       made a change in this turn. */
    .ai-write-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      margin-top: 6px;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: var(--affine-font-xs);
      line-height: 16px;
      font-weight: 500;
      color: var(--affine-text-secondary-color);
      background: var(--affine-hover-color);
    }
  `;

  @property({ attribute: false })
  accessor host: EditorHost | null | undefined;

  @property({ attribute: false })
  accessor std: BlockStdScope | null | undefined;

  @property({ attribute: false })
  accessor item!: ChatMessage;

  @property({ attribute: false })
  accessor isLast: boolean = false;

  @property({ attribute: 'data-status', reflect: true })
  accessor status: ChatStatus = 'idle';

  @property({ attribute: false })
  accessor error: AIError | null = null;

  @property({ attribute: false })
  accessor extensions!: ExtensionType[];

  @property({ attribute: false })
  accessor affineFeatureFlagService!: FeatureFlagService;

  @property({ attribute: false })
  accessor affineThemeService!: AppThemeService;

  @property({ attribute: false })
  accessor session!: CopilotChatHistoryFragment | null | undefined;

  @property({ attribute: false })
  accessor retry!: () => void;

  @property({ attribute: 'data-testid', reflect: true })
  accessor testId = 'chat-message-assistant';

  @property({ attribute: false })
  accessor width: Signal<number | undefined> | undefined;

  @property({ attribute: false })
  accessor notificationService!: NotificationService;

  @property({ attribute: false })
  accessor independentMode: boolean | undefined;

  @property({ attribute: false })
  accessor docDisplayService!: DocDisplayConfig;

  @property({ attribute: false })
  accessor peekViewService!: PeekViewService;

  @property({ attribute: false })
  accessor onOpenDoc!: (docId: string, sessionId?: string) => void;

  get state() {
    const { isLast, status } = this;
    return isLast
      ? status !== 'loading' && status !== 'transmitting'
        ? 'finished'
        : 'generating'
      : 'finished';
  }

  renderHeader() {
    const isWithDocs =
      'content' in this.item &&
      this.item.content &&
      this.item.content.includes('[^') &&
      /\[\^\d+\]:{"type":"doc","docId":"[^"]+"}/.test(this.item.content);

    return html`<div class="user-info">
      <chat-assistant-avatar .status=${this.status}></chat-assistant-avatar>
      ${isWithDocs
        ? html`<span class="message-info">with your docs</span>`
        : nothing}
    </div>`;
  }

  renderContent() {
    const { host, item, isLast, status, error } = this;
    const { streamObjects, content } = item;
    const shouldRenderError = isLast && status === 'error' && !!error;

    return html`
      ${this.renderImages()}
      ${streamObjects?.length
        ? this.renderStreamObjects(streamObjects)
        : this.renderRichText(content)}
      ${shouldRenderError ? AIChatErrorRenderer(error, host) : nothing}
      ${this.renderWriteChip()} ${this.renderEditorActions()}
    `;
  }

  // Knowledge-graph activation pulses: the optimistic frontend emit
  // path (which used to live here) was removed because the backend emits
  // its own `sourceId` via `crypto.randomUUID()` per tool call — there
  // was no shared key to dedupe against, so every doc read produced two
  // pulses (Codex PR review on #44). The /graph view now subscribes to
  // the backend SSE stream as the single source of truth; the ~100ms
  // round-trip is imperceptible against the 800ms pulse animation.
  //
  // If you need instant feedback again, plumb the AI SDK's `toolCallId`
  // through `CopilotToolExecuteOptions` so the backend can use it as
  // `sourceId`, then re-introduce the optimistic emit here with the
  // same id. Until then, do not emit from the frontend.

  // ε-AI-INTEL v1.10: render a "AI made changes" chip whenever the
  // assistant's stream contains a tool-call for a write tool. Backend
  // tool keys use snake_case (doc_edit, section_edit, doc_create, ...),
  // so we match against that set. Counting tool-results would over-count
  // when the model retries, so we count tool-calls.
  private renderWriteChip() {
    const streamObjects = this.item.streamObjects;
    if (!streamObjects?.length) return nothing;
    const writeToolNames = new Set([
      'doc_edit',
      'section_edit',
      'doc_create',
      'doc_update',
      'doc_update_meta',
      'doc_compose',
      'data_view_filter',
      'data_view_autofill_column',
    ]);
    const hasWriteCall = streamObjects.some(
      obj => obj.type === 'tool-call' && writeToolNames.has(obj.toolName)
    );
    if (!hasWriteCall) return nothing;
    return html`<div
      class="ai-write-chip"
      data-testid="ai-write-tool-chip"
      aria-label=${I18n.t('com.affine.ai.intelligence.tool-call.changes-made')}
    >
      ${I18n.t('com.affine.ai.intelligence.tool-call.changes-made')}
    </div>`;
  }

  private renderImages() {
    const { item } = this;
    if (!item.attachments) return nothing;

    return html`<chat-content-images
      .images=${item.attachments}
    ></chat-content-images>`;
  }

  private renderStreamObjects(answer: StreamObject[]) {
    return html`<chat-content-stream-objects
      .host=${this.host}
      .std=${this.std}
      .answer=${answer}
      .state=${this.state}
      .width=${this.width}
      .extensions=${this.extensions}
      .affineFeatureFlagService=${this.affineFeatureFlagService}
      .notificationService=${this.notificationService}
      .theme=${this.affineThemeService.appTheme.themeSignal}
      .independentMode=${this.independentMode}
      .docDisplayService=${this.docDisplayService}
      .peekViewService=${this.peekViewService}
      .onOpenDoc=${this.onOpenDoc}
    ></chat-content-stream-objects>`;
  }

  private renderRichText(text: string) {
    return html`<chat-content-rich-text
      .text=${text}
      .state=${this.state}
      .extensions=${this.extensions}
      .affineFeatureFlagService=${this.affineFeatureFlagService}
      .theme=${this.affineThemeService.appTheme.themeSignal}
    ></chat-content-rich-text>`;
  }

  private renderEditorActions() {
    const { item, isLast, status, host, session } = this;

    if (!isChatMessage(item) || item.role !== 'assistant') return nothing;

    if (
      isLast &&
      status !== 'success' &&
      status !== 'idle' &&
      status !== 'error'
    )
      return nothing;

    const { content, streamObjects, id: messageId } = item;
    const markdown = streamObjects?.length
      ? mergeStreamContent(streamObjects)
      : content;

    const actions = host
      ? isInsidePageEditor(host)
        ? PageEditorActions
        : EdgelessEditorActions
      : null;

    const showActions = host && !!markdown && !this.independentMode;

    return html`
      <chat-copy-more
        .host=${host}
        .session=${session}
        .actions=${showActions ? actions : []}
        .content=${markdown}
        .isLast=${isLast}
        .messageId=${messageId}
        .withMargin=${true}
        .retry=${() => this.retry()}
        .notificationService=${this.notificationService}
      ></chat-copy-more>
      ${isLast && showActions
        ? html`<chat-action-list
            .actions=${actions}
            .host=${host}
            .session=${session}
            .content=${markdown}
            .messageId=${messageId ?? undefined}
            .withMargin=${true}
            .notificationService=${this.notificationService}
          ></chat-action-list>`
        : nothing}
    `;
  }

  protected override render() {
    const { isLast, status } = this;

    if (isLast && status === 'loading') {
      return html`<ai-loading></ai-loading>`;
    }

    return html`
      ${this.renderHeader()}
      <div class="item-wrapper">${this.renderContent()}</div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'chat-message-assistant': ChatMessageAssistant;
  }
}
