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
import { property, state } from 'lit/decorators.js';

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
    /* Manut v1.12 chat redesign: glass bubble surface for assistant
       messages. The .item-wrapper wraps every assistant message body
       (renderImages + renderStreamObjects/renderRichText + write-chip +
       editor actions). A 2px accent-blue border on the left edge gives
       assistant messages a visual distinction from the violet-bordered
       user messages without leaning on the avatar alone. */
    .item-wrapper {
      position: relative;
      background-color: var(--manut-surface-glass);
      backdrop-filter: blur(20px) saturate(180%);
      -webkit-backdrop-filter: blur(20px) saturate(180%);
      border-radius: var(--manut-radius-card);
      border-left: 2px solid var(--manut-accent-blue-border);
      padding: 12px 14px;
      box-sizing: border-box;
    }
    /* Solid fallback for browsers without backdrop-filter support. */
    @supports (not (backdrop-filter: blur(20px))) and
      (not (-webkit-backdrop-filter: blur(20px))) {
      .item-wrapper {
        background-color: var(--affine-background-overlay-panel-color);
      }
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
    /* Manut M2 E2.4 — self-evolution feedback chips. One pair per
       assistant reply: thumbs-up / thumbs-down. Clicking flips the
       data-rating attribute (and triggers the rateMessage mutation
       in the click handler) so the chip visually locks to the user's
       choice. Brand-violet for the active state, neutral grey for
       the resting state — matches the violet user-message border. */
    .ai-feedback {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin-top: 6px;
      margin-left: 6px;
    }
    .ai-feedback-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 28px;
      height: 24px;
      padding: 0 6px;
      border-radius: var(--manut-radius-input);
      border: 1px solid var(--affine-border-color);
      background: transparent;
      color: var(--affine-text-secondary-color);
      font-size: var(--affine-font-xs);
      line-height: 16px;
      cursor: pointer;
      user-select: none;
      transition:
        background-color var(--affine-anim-duration-base, 200ms)
          var(--affine-anim-curve-default, ease),
        color var(--affine-anim-duration-base, 200ms)
          var(--affine-anim-curve-default, ease),
        border-color var(--affine-anim-duration-base, 200ms)
          var(--affine-anim-curve-default, ease);
    }
    .ai-feedback-button:hover:not([disabled]) {
      background: var(--affine-hover-color);
      color: var(--affine-text-primary-color);
    }
    .ai-feedback-button[data-active='true'] {
      border-color: var(--manut-accent-violet-border);
      color: var(--manut-accent-violet-fg, var(--affine-text-primary-color));
      background: var(--manut-accent-violet-bg, var(--affine-hover-color));
    }
    .ai-feedback-button[disabled] {
      cursor: default;
      opacity: 0.55;
    }
    /* Manut M2 E2.7 — typewriter cursor for streaming AI responses.
       The CopilotClient already delivers text deltas at the SSE
       token cadence (typically 8-15ms per chunk on Vertex), so the
       perceived effect is already token-by-token; what was missing
       was the visual cue that the response is still in flight. The
       blinking-bar glyph mirrors common terminal/AI chat patterns
       (ChatGPT, Claude.ai, Cursor) so users recognise it without
       any explanatory copy. Fades out via opacity transition on
       state="finished" so completion feels gentle, not abrupt.
       Animation is keyframe-based, not JS-driven, so the cursor
       continues to blink even while React/Lit is busy reflowing
       streamed markdown. */
    .ai-streaming-cursor {
      display: inline-block;
      width: 0.5em;
      height: 1em;
      margin-left: 2px;
      vertical-align: text-bottom;
      background-color: var(--manut-accent-violet-fg);
      border-radius: 1px;
      opacity: 0.85;
      transform-origin: center;
      animation: manut-cursor-blink 0.95s steps(1, end) infinite;
    }
    .ai-streaming-cursor[data-state='finished'] {
      animation: manut-cursor-fade-out 220ms ease-out forwards;
    }
    @keyframes manut-cursor-blink {
      0%,
      50% {
        opacity: 0.85;
      }
      50.01%,
      100% {
        opacity: 0;
      }
    }
    @keyframes manut-cursor-fade-out {
      from {
        opacity: 0.85;
        transform: scaleY(1);
      }
      to {
        opacity: 0;
        transform: scaleY(0.6);
      }
    }
    /* Honour the OS-level reduced-motion preference: hold the cursor
       at a steady 85% opacity instead of blinking. Users still see
       the in-flight signal; we just don't animate it. */
    @media (prefers-reduced-motion: reduce) {
      .ai-streaming-cursor {
        animation: none;
        opacity: 0.85;
      }
      .ai-streaming-cursor[data-state='finished'] {
        animation: none;
        opacity: 0;
      }
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

  // Manut M2 E2.4 — local state for the 👍/👎 feedback chips. Once the
  // user picks a rating we keep both buttons rendered (so they can flip
  // their mind without re-firing the request needlessly) but lock them
  // visually. `null` = nothing chosen yet; `pending` = mutation in
  // flight; `positive`/`negative` = settled.
  @state()
  accessor feedbackRating: 'positive' | 'negative' | 'pending' | null = null;

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
      ${this.renderStreamingCursor()}
      ${shouldRenderError ? AIChatErrorRenderer(error, host) : nothing}
      ${this.renderWriteChip()} ${this.renderFeedbackChips()}
      ${this.renderEditorActions()}
    `;
  }

  // Manut M2 E2.7 — typewriter cursor for streaming responses. We mount
  // the cursor span whenever the assistant is the last message AND its
  // generation is still in flight (loading or transmitting). Lit drops
  // the node on the next render once state flips to finished — but we
  // ALSO render it briefly with `data-state="finished"` to play the
  // fade-out animation; once that animation completes the node is
  // unmounted by the next streamObject/content change.
  //
  // We hide the cursor entirely for non-last messages and for error
  // states (the error-renderer already provides its own visual cue).
  private renderStreamingCursor() {
    const { isLast, status, error } = this;
    if (!isLast) return nothing;
    if (error) return nothing;
    const isGenerating = status === 'loading' || status === 'transmitting';
    if (!isGenerating) return nothing;
    return html`<span
      class="ai-streaming-cursor"
      data-state=${this.state}
      aria-hidden="true"
      data-testid="ai-streaming-cursor"
    ></span>`;
  }

  // Manut M2 E2.4 — render the 👍/👎 feedback chip pair below each
  // settled assistant message. Clicking fires rateMessage(messageId,
  // rating); the server persists an OBSERVATION memory which the
  // weekly distill cron summarises into the workspace PLAYBOOK. We
  // only render once the message has settled (status idle/success)
  // and only when we have a real messageId — streaming half-messages
  // and error states get no chip.
  private renderFeedbackChips() {
    const { item, status, isLast } = this;
    if (!isChatMessage(item) || item.role !== 'assistant') return nothing;
    if (!item.id) return nothing;
    // Skip rendering while the message is still streaming. We allow
    // 'idle', 'success', and any non-last (i.e., historical) status —
    // historical messages always get the chip so users can backfill
    // ratings on prior turns.
    if (isLast && status !== 'success' && status !== 'idle') {
      return nothing;
    }
    const settled =
      this.feedbackRating === 'positive' || this.feedbackRating === 'negative';
    const isPending = this.feedbackRating === 'pending';
    const ariaLabelUp = I18n.t('com.affine.ai.feedback.thumbs-up') as string;
    const ariaLabelDown = I18n.t(
      'com.affine.ai.feedback.thumbs-down'
    ) as string;
    // No backticks inside any css/html template literal — comments and
    // string content stay plain to avoid the v1.9.0 prod incident where
    // a stray backtick terminated the template silently.
    return html`<div
      class="ai-feedback"
      data-rating=${this.feedbackRating ?? 'none'}
      data-testid="ai-feedback-chips"
    >
      <button
        type="button"
        class="ai-feedback-button"
        data-active=${this.feedbackRating === 'positive'}
        data-rating="positive"
        data-testid="ai-feedback-thumbs-up"
        ?disabled=${isPending}
        aria-label=${ariaLabelUp || 'Thumbs up'}
        title=${ariaLabelUp || 'Thumbs up'}
        @click=${() => this.handleFeedback('positive')}
      >
        ${settled && this.feedbackRating === 'positive' ? '👍 ✓' : '👍'}
      </button>
      <button
        type="button"
        class="ai-feedback-button"
        data-active=${this.feedbackRating === 'negative'}
        data-rating="negative"
        data-testid="ai-feedback-thumbs-down"
        ?disabled=${isPending}
        aria-label=${ariaLabelDown || 'Thumbs down'}
        title=${ariaLabelDown || 'Thumbs down'}
        @click=${() => this.handleFeedback('negative')}
      >
        ${settled && this.feedbackRating === 'negative' ? '👎 ✓' : '👎'}
      </button>
    </div>`;
  }

  /**
   * Fire the rateMessage mutation. We POST to /graphql directly
   * (rather than via CopilotClient) so the Lit component doesn't need
   * a graphqlService dependency — the chat panel renders inside the
   * editor sandbox and threading DI through is more wiring than the
   * benefit. AFFiNE's GraphQL endpoint is `/graphql` (NOT
   * `/api/graphql`) — see CLAUDE.md §6.
   *
   * Same-origin fetch with `credentials: 'include'` carries the auth
   * cookie. Failures degrade silently: we revert the visual state to
   * `null` so the user can retry. No toast — the chip itself is the
   * confirmation surface.
   */
  private async handleFeedback(rating: 'positive' | 'negative') {
    if (this.feedbackRating === 'pending' || this.feedbackRating === rating) {
      return;
    }
    if (!isChatMessage(this.item) || !this.item.id) {
      return;
    }
    const messageId = this.item.id;
    this.feedbackRating = 'pending';
    try {
      const response = await fetch('/graphql', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          operationName: 'rateMessage',
          query:
            'mutation rateMessage($messageId: String!, $rating: String!) {\n' +
            '  rateMessage(messageId: $messageId, rating: $rating)\n' +
            '}',
          variables: { messageId, rating },
        }),
      });
      if (!response.ok) {
        throw new Error('rate-message-network-error');
      }
      const json = (await response.json()) as {
        data?: { rateMessage?: boolean };
        errors?: Array<{ message: string }>;
      };
      if (json.errors?.length || json.data?.rateMessage !== true) {
        throw new Error('rate-message-rejected');
      }
      this.feedbackRating = rating;
    } catch {
      // Revert so the user can retry. We deliberately don't surface
      // an error toast — this is a low-stakes interaction and the
      // unflipped chip is itself the indicator that nothing landed.
      this.feedbackRating = null;
    }
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
