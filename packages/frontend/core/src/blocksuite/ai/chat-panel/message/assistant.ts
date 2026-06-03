import type { FeatureFlagService } from '@affine/core/modules/feature-flag';
import type { PeekViewService } from '@affine/core/modules/peek-view';
import type { AppThemeService } from '@affine/core/modules/theme';
import { getAFFiNEWorkspaceSchema } from '@affine/core/modules/workspace';
import type { CopilotChatHistoryFragment } from '@affine/graphql';
import { I18n } from '@affine/i18n';
import { WithDisposable } from '@blocksuite/affine/global/lit';
import { RefNodeSlotsProvider } from '@blocksuite/affine/inlines/reference';
import { isInsidePageEditor } from '@blocksuite/affine/shared/utils';
import {
  type BlockStdScope,
  type EditorHost,
  ShadowlessElement,
} from '@blocksuite/affine/std';
import type { ExtensionType } from '@blocksuite/affine/store';
import { MarkdownTransformer } from '@blocksuite/affine/widgets/linked-doc';
import type { NotificationService } from '@blocksuite/affine-shared/services';
import { PageIcon } from '@blocksuite/icons/lit';
import type { Signal } from '@preact/signals-core';
import { css, html, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';

import { getStoreManager } from '../../../manager/store';
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
import { summarizeAssistantStatusChips } from './assistant-status';

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
    /* ε-AI-INTEL v1.14: compact status chips summarise what the assistant
       used in this turn: tools, sources, writes, and failures. Derived from
       StreamObject tool-call / tool-result chunks, so completed tools remain
       visible after mergeStreamObjects replaces the original call chunk. */
    .ai-status-chips {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
      margin-top: 6px;
    }
    .ai-status-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: var(--affine-font-xs);
      line-height: 16px;
      font-weight: 500;
      color: var(--affine-text-secondary-color);
      background: var(--affine-hover-color);
    }
    .ai-status-chip[data-kind='writes'] {
      color: var(--manut-accent-violet-fg, var(--affine-text-primary-color));
      background: var(--manut-accent-violet-bg, var(--affine-hover-color));
    }
    .ai-status-chip[data-kind='failures'] {
      color: var(--affine-error-color);
      background: color-mix(
        in srgb,
        var(--affine-error-color) 10%,
        transparent
      );
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
    .ai-save-doc-actions {
      display: flex;
      justify-content: flex-end;
      margin-top: 8px;
    }
    .ai-save-doc-button {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-height: 32px;
      padding: 0 10px;
      border-radius: var(--manut-radius-input, 8px);
      border: 1px solid var(--affine-border-color);
      background: var(--affine-background-overlay-panel-color);
      color: var(--affine-text-primary-color);
      font-size: var(--affine-font-sm);
      font-weight: 500;
      line-height: 20px;
      cursor: pointer;
      transition:
        background-color var(--affine-anim-duration-base, 200ms)
          var(--affine-anim-curve-default, ease),
        color var(--affine-anim-duration-base, 200ms)
          var(--affine-anim-curve-default, ease),
        border-color var(--affine-anim-duration-base, 200ms)
          var(--affine-anim-curve-default, ease);
    }
    .ai-save-doc-button:hover:not([disabled]) {
      background: var(--affine-hover-color);
    }
    .ai-save-doc-button[data-state='saved'] {
      border-color: var(--manut-accent-violet-border);
      color: var(--manut-accent-violet-fg, var(--affine-text-primary-color));
      background: var(--manut-accent-violet-bg, var(--affine-hover-color));
    }
    .ai-save-doc-button[disabled] {
      cursor: default;
      opacity: 0.65;
    }
    .ai-save-doc-button svg {
      width: 16px;
      height: 16px;
      color: currentColor;
      flex: 0 0 auto;
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

  @state()
  accessor savedDocId: string | null = null;

  @state()
  accessor savedDocMessageKey: string | null = null;

  @state()
  accessor savingDocMessageKey: string | null = null;

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
      ${this.renderStatusChips()} ${this.renderFeedbackChips()}
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

  private renderStatusChips() {
    const chips = summarizeAssistantStatusChips(this.item.streamObjects);
    if (!chips.length) return nothing;
    return html`<div class="ai-status-chips" data-testid="ai-status-chips">
      ${chips.map(
        chip =>
          html`<div
            class="ai-status-chip"
            data-kind=${chip.kind}
            data-testid=${chip.testId}
            aria-label=${chip.label}
            title=${chip.label}
          >
            ${chip.label}
          </div>`
      )}
    </div>`;
  }

  private getMessageSaveKey() {
    if (!isChatMessage(this.item)) return null;
    return this.item.id || this.item.createdAt || this.item.content;
  }

  private cleanDocTitle(value: string | undefined) {
    const title = value
      ?.replace(/^[\s#>*-]+/, '')
      .replace(/[*_`[\]]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!title) return 'AI generated doc';
    return title.slice(0, 80);
  }

  private getSaveAsDocPayload(): { markdown: string; title: string } | null {
    const { content, streamObjects } = this.item;
    const composeResult = streamObjects?.find(
      streamObject =>
        streamObject.type === 'tool-result' &&
        streamObject.toolName === 'doc_compose' &&
        streamObject.result &&
        typeof streamObject.result === 'object' &&
        'markdown' in streamObject.result &&
        typeof streamObject.result.markdown === 'string'
    );
    if (composeResult?.type === 'tool-result') {
      const result = composeResult.result as {
        markdown: string;
        title?: string;
      };
      const title =
        typeof composeResult.args?.title === 'string'
          ? composeResult.args.title
          : result.title;
      return {
        markdown: result.markdown,
        title: this.cleanDocTitle(title),
      };
    }

    const textMarkdown = streamObjects?.length
      ? mergeStreamContent(streamObjects)
      : content;
    if (textMarkdown.trim()) {
      const heading = textMarkdown
        .split('\n')
        .map(line => line.trim())
        .find(line => line.length > 0);
      return {
        markdown: textMarkdown,
        title: this.cleanDocTitle(heading),
      };
    }

    return null;
  }

  private openSavedDoc(docId: string) {
    if (this.onOpenDoc) {
      this.onOpenDoc(docId, this.session?.sessionId);
      return;
    }
    const { host } = this;
    host?.std.getOptional(RefNodeSlotsProvider)?.docLinkClicked.next({
      pageId: docId,
      openMode: 'open-in-active-view',
      host,
    });
  }

  private async handleSaveAsDoc(markdown: string, title: string) {
    const { host } = this;
    const messageKey = this.getMessageSaveKey();
    if (!host || !messageKey || this.savingDocMessageKey === messageKey) {
      return;
    }

    this.savingDocMessageKey = messageKey;
    try {
      const docId = await MarkdownTransformer.importMarkdownToDoc({
        collection: host.store.workspace,
        schema: getAFFiNEWorkspaceSchema(),
        markdown,
        fileName: title,
        extensions: getStoreManager().config.init().value.get('store'),
      });
      if (!docId) {
        throw new Error('save-as-doc-empty-result');
      }
      this.savedDocId = docId;
      this.savedDocMessageKey = messageKey;
      this.notificationService.notify({
        title: 'Doc saved',
        message: 'AI output was saved as a new doc.',
        accent: 'success',
        actions: [
          {
            key: 'open-doc',
            label: 'Open',
            onClick: () => this.openSavedDoc(docId),
          },
        ],
        onClose: function (): void {},
      });
    } catch (error) {
      console.error(error);
      this.notificationService.toast('Failed to save document');
    } finally {
      if (this.savingDocMessageKey === messageKey) {
        this.savingDocMessageKey = null;
      }
    }
  }

  private renderSaveAsDocAction() {
    const { host, independentMode, isLast, status } = this;
    if (!host || !independentMode) return nothing;
    if (isLast && status !== 'success' && status !== 'idle') return nothing;

    const payload = this.getSaveAsDocPayload();
    if (!payload?.markdown.trim()) return nothing;

    const messageKey = this.getMessageSaveKey();
    const isSaving = !!messageKey && this.savingDocMessageKey === messageKey;
    const savedDocId =
      messageKey && this.savedDocMessageKey === messageKey
        ? this.savedDocId
        : null;
    const label = savedDocId
      ? 'Open saved doc'
      : isSaving
        ? 'Saving...'
        : 'Save as doc';

    return html`<div class="ai-save-doc-actions">
      <button
        type="button"
        class="ai-save-doc-button"
        data-state=${savedDocId ? 'saved' : isSaving ? 'saving' : 'idle'}
        data-testid="ai-save-as-doc-button"
        ?disabled=${isSaving}
        aria-label=${label}
        title=${label}
        @click=${() =>
          savedDocId
            ? this.openSavedDoc(savedDocId)
            : this.handleSaveAsDoc(payload.markdown, payload.title)}
      >
        ${PageIcon({ width: '16', height: '16' })}
        <span>${label}</span>
      </button>
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
      ${this.renderSaveAsDocAction()}
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
    const content = this.item?.content ?? '';
    const hasContent =
      content.trim().length > 0 || !!this.item?.streamObjects?.length;

    if (
      isLast &&
      (status === 'loading' || (status === 'transmitting' && !hasContent))
    ) {
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
