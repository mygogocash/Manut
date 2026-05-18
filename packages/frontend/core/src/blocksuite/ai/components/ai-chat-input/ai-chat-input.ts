import type {
  AIDraftService,
  AIToolsConfigService,
} from '@affine/core/modules/ai-button';
import type { AIModelService } from '@affine/core/modules/ai-button/services/models';
import type {
  ServerService,
  SubscriptionService,
} from '@affine/core/modules/cloud';
import type { FeatureFlagService } from '@affine/core/modules/feature-flag';
import type { CopilotChatHistoryFragment } from '@affine/graphql';
import { createLitPortal } from '@blocksuite/affine/components/portal';
import { SignalWatcher, WithDisposable } from '@blocksuite/affine/global/lit';
import { unsafeCSSVar, unsafeCSSVarV2 } from '@blocksuite/affine/shared/theme';
import type { EditorHost } from '@blocksuite/affine/std';
import { ShadowlessElement } from '@blocksuite/affine/std';
import type { NotificationService } from '@blocksuite/affine-shared/services';
import { ArrowUpBigIcon, CloseIcon } from '@blocksuite/icons/lit';
import { flip, offset, shift } from '@floating-ui/dom';
import { css, html, nothing, type PropertyValues } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { styleMap } from 'lit/directives/style-map.js';

import { ChatAbortIcon } from '../../_common/icons';
import { type AIError, AIProvider, type AISendParams } from '../../provider';
import { reportResponse } from '../../utils/action-reporter';
import { readBlobAsURL } from '../../utils/image';
import { mergeStreamObjects } from '../../utils/stream-objects';
import type { MentionMember, SearchMenuConfig } from '../ai-chat-add-context';
import type { ChatChip, DocDisplayConfig } from '../ai-chat-chips/type';
import { isDocChip } from '../ai-chat-chips/utils';
import {
  type ChatMessage,
  isChatMessage,
  StreamObjectSchema,
} from '../ai-chat-messages';
import type { AIChatInputContext, AIReasoningConfig } from './type';

function getFirstTwoLines(text: string) {
  const lines = text.split('\n');
  return lines.slice(0, 2);
}

export class AIChatInput extends SignalWatcher(
  WithDisposable(ShadowlessElement)
) {
  static override styles = css`
    :host {
      width: 100%;
    }

    [data-theme='dark'] .chat-panel-input {
      box-shadow:
        var(--border-shadow),
        0px 0px 0px 0px rgba(28, 158, 228, 0),
        0px 0px 0px 2px transparent;
    }
    [data-theme='light'] .chat-panel-input,
    .chat-panel-input {
      box-shadow:
        var(--border-shadow),
        0px 0px 0px 3px transparent,
        0px 2px 3px rgba(0, 0, 0, 0.05);
    }
    /* Manut v1.12: focus ring uses --manut-accent-blue-border so both
       light and dark themes get a consistent Manut-branded focus state.
       Drop shadow stays for elevation; ring colour is the Manut token. */
    .chat-panel-input[data-if-focused='true'] {
      box-shadow:
        var(--border-shadow),
        0px 0px 0px 3px var(--manut-accent-blue-border),
        0px 4px 6px rgba(0, 0, 0, 0.05);
    }
    [data-theme='dark'] .chat-panel-input[data-if-focused='true'] {
      box-shadow:
        var(--border-shadow),
        0px 0px 0px 3px var(--manut-accent-blue-border),
        0px 2px 3px rgba(0, 0, 0, 0.05);
    }

    /* Manut v1.12: input bar border radius bumped from 12px to
       --manut-radius-modal (20px) for the softer modern feel.
       Background stays solid for input legibility. */
    .chat-panel-input {
      --input-border-width: 0.5px;
      --input-border-color: var(--affine-v2-layer-insideBorder-border);
      --border-shadow: 0px 0px 0px var(--input-border-width)
        var(--input-border-color);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 4px;
      position: relative;
      border-radius: var(--manut-radius-modal);
      padding: 8px 6px 6px 8px;
      min-height: 94px;
      box-sizing: border-box;
      transition: box-shadow 0.23s ease;
      background-color: var(--affine-v2-input-background);

      &[data-independent-mode='true'] {
        padding: 12px;
        border-radius: var(--manut-radius-modal);
      }

      .chat-selection-quote {
        padding: 4px 0px 8px 0px;
        padding-left: 15px;
        max-height: 56px;
        font-size: 14px;
        font-weight: 400;
        line-height: 22px;
        color: var(--affine-text-secondary-color);
        position: relative;

        div {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .chat-quote-close {
          position: absolute;
          right: 0;
          top: 0;
          cursor: pointer;
          display: none;
          width: 16px;
          height: 16px;
          border-radius: 4px;
          border: 1px solid var(--affine-border-color);
          background-color: var(--affine-white);
        }
      }

      .chat-selection-quote:hover .chat-quote-close {
        display: flex;
        justify-content: center;
        align-items: center;
      }

      .chat-selection-quote::after {
        content: '';
        width: 2px;
        height: calc(100% - 10px);
        margin-top: 5px;
        position: absolute;
        left: 0;
        top: 0;
        background: var(--affine-quote-color);
        border-radius: 18px;
      }
    }

    .chat-panel-input-actions {
      display: flex;
      gap: 8px;
      align-items: center;

      .chat-input-icon {
        cursor: pointer;
        padding: 2px;
        display: flex;
        justify-content: center;
        align-items: center;
        border-radius: 4px;

        svg {
          width: 20px;
          height: 20px;
          color: ${unsafeCSSVarV2('icon/primary')};
        }

        .chat-input-icon-label {
          font-size: 14px;
          line-height: 22px;
          font-weight: 500;
          color: ${unsafeCSSVarV2('icon/primary')};
          margin: 0 4px 0 4px;
        }
      }

      .chat-input-icon:nth-child(2) {
        margin-left: auto;
      }

      .chat-input-icon:hover {
        background-color: ${unsafeCSSVarV2('layer/background/hoverOverlay')};
      }

      .chat-input-icon[data-active='true'] {
        background-color: #1e96eb14;

        svg {
          color: ${unsafeCSSVarV2('icon/activated')};
        }

        .chat-input-icon-label {
          color: ${unsafeCSSVarV2('icon/activated')};
        }
      }

      .chat-input-icon[aria-disabled='true'] {
        cursor: not-allowed;

        svg {
          color: ${unsafeCSSVarV2('icon/secondary')} !important;
        }
      }
    }

    .chat-panel-input {
      textarea {
        width: 100%;
        padding: 0;
        margin: 0;
        border: none;
        line-height: 22px;
        font-size: var(--affine-font-sm);
        font-weight: 400;
        font-family: var(--affine-font-family);
        color: var(--affine-text-primary-color);
        box-sizing: border-box;
        resize: none;
        overflow-y: scroll;
        background-color: transparent;
      }

      textarea::-webkit-scrollbar {
        -webkit-appearance: none;
        width: 4px;
        display: block;
      }

      textarea::-webkit-scrollbar:horizontal {
        height: 8px;
      }

      textarea::-webkit-scrollbar-thumb {
        border-radius: 2px;
        background-color: transparent;
      }

      textarea:hover::-webkit-scrollbar-thumb {
        border-radius: 16px;
        background-color: ${unsafeCSSVar('black30')};
      }

      textarea::placeholder {
        font-size: 14px;
        font-weight: 400;
        font-family: var(--affine-font-family);
        color: var(--affine-v2-text-placeholder);
      }

      textarea:focus {
        outline: none;
      }
    }

    .chat-panel-input[data-if-focused='true'] {
      --input-border-width: 1px;
      --input-border-color: var(--affine-v2-layer-insideBorder-primaryBorder);
      user-select: none;
    }

    .chat-panel-send {
      display: flex;
      justify-content: center;
      align-items: center;
      width: 28px;
      height: 28px;
      flex-shrink: 0;
      border-radius: 50%;
      font-size: 20px;
      background: var(--affine-v2-icon-activated);
      color: var(--affine-v2-layer-pureWhite);
      border: none;
      padding: 0;
      cursor: pointer;
    }
    .chat-panel-send[aria-disabled='true'] {
      cursor: not-allowed;
      background: var(--affine-v2-button-disable);
    }
    .chat-panel-stop {
      cursor: pointer;
      width: 28px;
      height: 28px;
      flex-shrink: 0;
      display: flex;
      justify-content: center;
      align-items: center;
      border-radius: 50%;
      font-size: 24px;
      color: var(--affine-v2-icon-activated);
      border: none;
      padding: 0;
      background: transparent;
    }
    .chat-input-footer-spacer {
      flex: 1;
    }
  `;

  @property({ attribute: false })
  accessor independentMode: boolean | undefined;

  @property({ attribute: false })
  accessor host: EditorHost | null | undefined;

  @property({ attribute: false })
  accessor workspaceId!: string;

  @property({ attribute: false })
  accessor docId: string | undefined;

  @property({ attribute: false })
  accessor session!: CopilotChatHistoryFragment | null | undefined;

  @property({ attribute: false })
  accessor isContextProcessing!: boolean | undefined;

  @query('image-preview-grid')
  accessor imagePreviewGrid: HTMLDivElement | null = null;

  @query('textarea')
  accessor textarea!: HTMLTextAreaElement;

  @state()
  accessor isInputEmpty = true;

  @state()
  accessor focused = false;

  @property({ attribute: false })
  accessor chatContextValue!: AIChatInputContext;

  @property({ attribute: false })
  accessor chips: ChatChip[] = [];

  @property({ attribute: false })
  accessor createSession!: () => Promise<
    CopilotChatHistoryFragment | undefined
  >;

  @property({ attribute: false })
  accessor updateContext!: (context: Partial<AIChatInputContext>) => void;

  @property({ attribute: false })
  accessor addImages!: (images: File[]) => void;

  @property({ attribute: false })
  accessor addChip!: (chip: ChatChip, silent?: boolean) => Promise<void>;

  @property({ attribute: false })
  accessor reasoningConfig!: AIReasoningConfig;

  @property({ attribute: false })
  accessor docDisplayConfig!: DocDisplayConfig;

  @property({ attribute: false })
  accessor searchMenuConfig!: SearchMenuConfig;

  @property({ attribute: false })
  accessor serverService!: ServerService;

  @property({ attribute: false })
  accessor aiDraftService: AIDraftService | undefined;

  @property({ attribute: false })
  accessor aiToolsConfigService!: AIToolsConfigService;

  @property({ attribute: false })
  accessor affineFeatureFlagService!: FeatureFlagService;

  @property({ attribute: false })
  accessor notificationService!: NotificationService;

  @property({ attribute: false })
  accessor subscriptionService!: SubscriptionService;

  @property({ attribute: false })
  accessor aiModelService!: AIModelService;

  @property({ attribute: false })
  accessor onAISubscribe!: () => Promise<void>;

  @property({ attribute: false })
  accessor isRootSession: boolean = true;

  @property({ attribute: false })
  accessor onChatSuccess: (() => void) | undefined;

  @property({ attribute: false })
  accessor trackOptions: BlockSuitePresets.TrackerOptions | undefined;

  @property({ attribute: 'data-testid', reflect: true })
  accessor testId = 'chat-panel-input-container';

  @property({ attribute: false })
  accessor portalContainer: HTMLElement | null = null;

  private get _isReasoningActive() {
    return !!this.reasoningConfig.enabled.value;
  }

  override connectedCallback() {
    super.connectedCallback();

    this._disposables.add(
      AIProvider.slots.requestSendWithChat.subscribe(
        (params: AISendParams | null) => {
          if (!params) {
            return;
          }
          const { input, context, host } = params;
          if (this.host === host) {
            if (context) {
              this.updateContext(context);
            }
            setTimeout(() => {
              this.send(input).catch(console.error);
            }, 0);
          }
          AIProvider.slots.requestSendWithChat.next(null);
        }
      )
    );

    this._disposables.add(
      AIProvider.slots.requestOpenWithChat.subscribe(params => {
        if (!params) return;

        const { input, host } = params;
        if (this.host !== host) return;

        if (input) {
          this.textarea.value = input;
          this.isInputEmpty = !this.textarea.value.trim();
        }
      })
    );
  }

  protected override firstUpdated(changedProperties: PropertyValues): void {
    super.firstUpdated(changedProperties);
    if (this.aiDraftService) {
      this.aiDraftService
        .getDraft()
        .then(draft => {
          this.textarea.value = draft.input;
          this.isInputEmpty = !this.textarea.value.trim();
        })
        .catch(console.error);
    }
  }

  protected override render() {
    const { images, status } = this.chatContextValue;
    const hasImages = images.length > 0;
    const maxHeight = hasImages ? 272 + 2 : 200 + 2;

    return html`<div
      class="chat-panel-input"
      data-independent-mode=${this.independentMode}
      data-if-focused=${this.focused}
      style=${styleMap({
        maxHeight: `${maxHeight}px !important`,
      })}
      @pointerdown=${this._handlePointerDown}
    >
      ${hasImages
        ? html`
            <image-preview-grid
              .images=${images}
              .onImageRemove=${this._handleImageRemove}
            ></image-preview-grid>
          `
        : nothing}
      ${this.chatContextValue.quote
        ? html`<div
            class="chat-selection-quote"
            data-testid="chat-selection-quote"
          >
            ${repeat(
              getFirstTwoLines(this.chatContextValue.quote),
              line => line,
              line => html`<div>${line}</div>`
            )}
            <div
              class="chat-quote-close"
              @click=${() => {
                this.updateContext({ quote: '', markdown: '' });
              }}
            >
              ${CloseIcon()}
            </div>
          </div>`
        : nothing}
      <textarea
        rows="1"
        placeholder="What are your thoughts?"
        @input=${this._handleInput}
        @keydown=${this._handleKeyDown}
        @focus=${() => {
          this.focused = true;
        }}
        @blur=${() => {
          this.focused = false;
        }}
        @paste=${this._handlePaste}
        data-testid="chat-panel-input"
      ></textarea>
      <div class="chat-panel-input-actions">
        <div class="chat-input-icon">
          <ai-chat-add-context
            .docId=${this.docId}
            .independentMode=${this.independentMode}
            .addChip=${this.addChip}
            .addImages=${this.addImages}
            .docDisplayConfig=${this.docDisplayConfig}
            .searchMenuConfig=${this.searchMenuConfig}
            .portalContainer=${this.portalContainer}
          ></ai-chat-add-context>
        </div>
        <div class="chat-input-footer-spacer"></div>
        <chat-input-preference
          .session=${this.session}
          .extendedThinking=${this._isReasoningActive}
          .onExtendedThinkingChange=${this._toggleReasoning}
          .serverService=${this.serverService}
          .toolsConfigService=${this.aiToolsConfigService}
          .notificationService=${this.notificationService}
          .subscriptionService=${this.subscriptionService}
          .aiModelService=${this.aiModelService}
          .onAISubscribe=${this.onAISubscribe}
        ></chat-input-preference>
        ${status === 'transmitting' || status === 'loading'
          ? html`<button
              class="chat-panel-stop"
              @click=${this._handleAbort}
              data-testid="chat-panel-stop"
            >
              ${ChatAbortIcon}
            </button>`
          : html`<button
              @click="${this._onTextareaSend}"
              class="chat-panel-send"
              aria-disabled=${this.isSendDisabled}
              data-testid="chat-panel-send"
            >
              ${ArrowUpBigIcon()}
            </button>`}
      </div>
    </div>`;
  }

  private get isSendDisabled() {
    if (this.isInputEmpty) {
      return true;
    }

    if (this.isContextProcessing) {
      return true;
    }

    return false;
  }

  private readonly _handlePointerDown = (e: MouseEvent) => {
    if (e.target !== this.textarea) {
      // by default the div will be focused and will blur the textarea
      e.preventDefault();
      this.textarea.focus();
    }
  };

  // ---- @-mention state ----
  private _mentionAbort: AbortController | null = null;
  private _mentionedMembers: MentionMember[] = [];

  private readonly _handleInput = async () => {
    const { textarea } = this;
    const value = textarea.value.trim();
    this.isInputEmpty = !value;

    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
    let imagesHeight = this.imagePreviewGrid?.scrollHeight ?? 0;
    if (imagesHeight) imagesHeight += 12;
    if (this.scrollHeight >= 200 + imagesHeight) {
      textarea.style.height = '148px';
      textarea.style.overflowY = 'scroll';
    }

    // Update mention popup query if open.
    this._syncMentionState();

    if (this.aiDraftService) {
      await this.aiDraftService.setDraft({
        input: value,
      });
    }
  };

  private readonly _handleKeyDown = async (evt: KeyboardEvent) => {
    // While the mention popup owns navigation/Enter, swallow those here so
    // we don't send the message or move the textarea cursor in conflict.
    if (
      this._mentionAbort &&
      (evt.key === 'ArrowDown' ||
        evt.key === 'ArrowUp' ||
        evt.key === 'Enter' ||
        evt.key === 'Escape')
    ) {
      // Popup component handles these via its own document listener.
      return;
    }

    if (evt.key === 'Enter' && !evt.shiftKey && !evt.isComposing) {
      await this._onTextareaSend(evt);
      return;
    }

    if (evt.key === '@' && !evt.isComposing) {
      // Defer one tick so the '@' is in the textarea value.
      requestAnimationFrame(() => {
        this._openMentionPopup();
      });
    }
  };

  /**
   * Compute the current `@query` segment (if any) at the cursor and either
   * open the popup, update its query, or close it.
   */
  private _syncMentionState() {
    const segment = this._currentMentionSegment();
    if (!segment) {
      this._closeMentionPopup();
      return;
    }
    if (this._mentionAbort) {
      // Popup is open — update its query attribute.
      const popup = this._currentMentionPopup();
      if (popup) {
        popup.query = segment.query;
      }
    } else {
      this._openMentionPopup();
    }
  }

  /**
   * Returns the active `@…` mention segment under the cursor, or null if
   * cursor is not inside a valid mention trigger position.
   */
  private _currentMentionSegment(): {
    start: number;
    end: number;
    query: string;
  } | null {
    const { textarea } = this;
    if (!textarea) return null;
    const cursor = textarea.selectionStart ?? 0;
    const text = textarea.value;
    // Walk back from cursor to find an unbroken non-whitespace token starting
    // with '@'. Cancel if we encounter a whitespace/newline before '@'.
    for (let i = cursor - 1; i >= 0; i--) {
      const ch = text[i];
      if (ch === '@') {
        // Must be at start of input or preceded by whitespace.
        const prev = i === 0 ? ' ' : text[i - 1];
        if (!/\s/.test(prev)) return null;
        return {
          start: i,
          end: cursor,
          query: text.slice(i + 1, cursor),
        };
      }
      if (ch === ' ' || ch === '\n' || ch === '\t') return null;
    }
    return null;
  }

  private _currentMentionPopup(): {
    query: string;
  } | null {
    const root = this.portalContainer ?? document.body;
    const popup = root.querySelector('ai-chat-mention-popup') as unknown as {
      query: string;
    } | null;
    return popup;
  }

  private _openMentionPopup() {
    const segment = this._currentMentionSegment();
    if (!segment) return;
    if (this._mentionAbort) {
      // Already open — just sync.
      const popup = this._currentMentionPopup();
      if (popup) popup.query = segment.query;
      return;
    }

    const abort = new AbortController();
    this._mentionAbort = abort;
    abort.signal.addEventListener('abort', () => {
      if (this._mentionAbort === abort) {
        this._mentionAbort = null;
      }
    });

    createLitPortal({
      template: html`
        <ai-chat-mention-popup
          .query=${segment.query}
          .searchMenuConfig=${this.searchMenuConfig}
          .abortController=${abort}
          .onSelectDoc=${this._onMentionSelectDoc}
          .onSelectMember=${this._onMentionSelectMember}
          .onCancel=${() => abort.abort()}
        ></ai-chat-mention-popup>
      `,
      portalStyles: {
        zIndex: 'var(--affine-z-index-popover)',
      },
      container: this.portalContainer ?? document.body,
      computePosition: {
        referenceElement: this.textarea,
        placement: 'top-start',
        middleware: [offset({ mainAxis: 8 }), flip(), shift({ padding: 8 })],
        autoUpdate: { animationFrame: true },
      },
      abortController: abort,
      closeOnClickAway: true,
    });
  }

  private _closeMentionPopup() {
    this._mentionAbort?.abort();
  }

  /**
   * Replace the active `@query` segment in the textarea with `replacement`.
   * Returns the new cursor position.
   */
  private _replaceMentionSegment(replacement: string) {
    const segment = this._currentMentionSegment();
    if (!segment) return;
    const { textarea } = this;
    const before = textarea.value.slice(0, segment.start);
    const after = textarea.value.slice(segment.end);
    textarea.value = before + replacement + after;
    const newCursor = before.length + replacement.length;
    textarea.selectionStart = textarea.selectionEnd = newCursor;
    this.isInputEmpty = !textarea.value.trim();
  }

  private readonly _onMentionSelectDoc = (docId: string, _title: string) => {
    // Drop the @query trigger entirely — the page becomes a chip above the
    // textarea via the existing chip pipeline.
    this._replaceMentionSegment('');
    this._closeMentionPopup();
    this.addChip({
      docId,
      state: 'processing',
    }).catch(console.error);
    this.textarea.focus();
  };

  private readonly _onMentionSelectMember = (member: MentionMember) => {
    // Replace `@query` with `@Name ` text inline.
    const display = `@${member.name} `;
    this._replaceMentionSegment(display);
    // Track for prompt augmentation on send.
    if (!this._mentionedMembers.some(m => m.id === member.id)) {
      this._mentionedMembers = [...this._mentionedMembers, member];
    }
    this._closeMentionPopup();
    this.textarea.focus();
  };

  private readonly _handlePaste = (event: ClipboardEvent) => {
    event.stopPropagation();
    const items = event.clipboardData?.items;
    if (!items) return;

    for (const index in items) {
      const item = items[index];
      if (item.kind === 'file' && item.type.indexOf('image') >= 0) {
        const blob = item.getAsFile();
        if (!blob) continue;
        this.addImages([blob]);
      }
    }
  };

  private readonly _handleAbort = () => {
    this.chatContextValue.abortController?.abort();
    this.updateContext({ status: 'success' });
    reportResponse('aborted:stop');
  };

  private readonly _toggleReasoning = (extendedThinking: boolean) => {
    this.reasoningConfig.setEnabled(extendedThinking);
  };

  private readonly _handleImageRemove = (index: number) => {
    const oldImages = this.chatContextValue.images;
    const newImages = oldImages.filter((_, i) => i !== index);
    this.updateContext({ images: newImages });
  };

  private readonly _onTextareaSend = async (e: MouseEvent | KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const value = this.textarea.value.trim();
    if (value.length === 0) return;

    // Snapshot and reset mention state for this message.
    const mentionedMembers = this._mentionedMembers;
    this._mentionedMembers = [];

    this.textarea.value = '';
    this.isInputEmpty = true;
    this.textarea.style.height = 'unset';

    if (this.aiDraftService) {
      await this.aiDraftService.setDraft({
        input: '',
      });
    }

    // Append a context note for any @-mentioned people so the AI knows who
    // is being referenced. v1: text-only, no profile resolution.
    let prompt = value;
    if (mentionedMembers.length > 0) {
      const lines = mentionedMembers
        .filter(m => value.includes(`@${m.name}`))
        .map(m => (m.email ? `- ${m.name} (${m.email})` : `- ${m.name}`));
      if (lines.length > 0) {
        prompt = `${value}\n\n[Mentioned people]\n${lines.join('\n')}`;
      }
    }

    await this.send(prompt);
  };

  send = async (text: string) => {
    try {
      const {
        status,
        markdown,
        images,
        snapshot,
        combinedElementsMarkdown,
        html,
      } = this.chatContextValue;

      if (status === 'loading' || status === 'transmitting') return;
      if (!text) return;
      if (!AIProvider.actions.chat) return;

      const abortController = new AbortController();
      this.updateContext({
        images: [],
        status: 'loading',
        error: null,
        quote: '',
        markdown: '',
        abortController,
      });

      const imageAttachments = await Promise.all(
        images?.map(image => readBlobAsURL(image))
      );
      const userInput = (markdown ? `${markdown}\n` : '') + text;

      // optimistic update messages
      await this._preUpdateMessages(userInput, imageAttachments);

      const sessionId = (await this.createSession())?.sessionId;
      let contexts = await this._getMatchedContexts();
      if (abortController.signal.aborted) {
        return;
      }

      const enableSendDetailedObject =
        this.affineFeatureFlagService.flags.enable_send_detailed_object_to_ai
          .value;

      const modelId = this.aiModelService.modelId.value;
      const stream = await AIProvider.actions.chat({
        sessionId,
        input: userInput,
        contexts: {
          ...contexts,
          selectedSnapshot:
            snapshot && enableSendDetailedObject ? snapshot : undefined,
          selectedMarkdown:
            combinedElementsMarkdown && enableSendDetailedObject
              ? combinedElementsMarkdown
              : undefined,
          html: html || undefined,
        },
        docId: this.docId,
        attachments: images,
        workspaceId: this.workspaceId,
        stream: true,
        signal: abortController.signal,
        isRootSession: this.isRootSession,
        where: this.trackOptions?.where,
        control: this.trackOptions?.control,
        reasoning: this._isReasoningActive,
        toolsConfig: this.aiToolsConfigService.config.value,
        modelId,
      });

      for await (const text of stream) {
        const messages = this.chatContextValue.messages.slice(0);
        const last = messages.at(-1);
        if (last && isChatMessage(last)) {
          try {
            const parsed = StreamObjectSchema.parse(JSON.parse(text));
            const streamObjects = mergeStreamObjects([
              ...(last.streamObjects ?? []),
              parsed,
            ]);
            messages[messages.length - 1] = {
              ...last,
              streamObjects,
            };
          } catch {
            messages[messages.length - 1] = {
              ...last,
              content: last.content + text,
            };
          }
          this.updateContext({ messages, status: 'transmitting' });
        }
      }

      this.updateContext({ status: 'success' });
      this.onChatSuccess?.();
      // update message id from server
      await this._postUpdateMessages();
    } catch (error) {
      this.updateContext({ status: 'error', error: error as AIError });
    } finally {
      this.updateContext({ abortController: null });
    }
  };

  private readonly _preUpdateMessages = async (
    userInput: string,
    attachments: string[]
  ) => {
    const userInfo = await AIProvider.userInfo;
    this.updateContext({
      messages: [
        ...this.chatContextValue.messages,
        {
          id: '',
          role: 'user',
          content: userInput,
          createdAt: new Date().toISOString(),
          attachments,
          userId: userInfo?.id,
          userName: userInfo?.name,
          avatarUrl: userInfo?.avatarUrl ?? undefined,
        },
        {
          id: '',
          role: 'assistant',
          content: '',
          createdAt: new Date().toISOString(),
        },
      ],
    });
  };

  private readonly _postUpdateMessages = async () => {
    const sessionId = this.session?.sessionId;
    if (!sessionId || !AIProvider.histories) return;

    const { messages } = this.chatContextValue;
    const last = messages[messages.length - 1] as ChatMessage;
    if (!last.id) {
      const historyIds = await AIProvider.histories.ids(
        this.workspaceId,
        this.docId,
        { sessionId, withMessages: true }
      );
      if (!historyIds || !historyIds[0]) return;
      last.id = historyIds[0].messages.at(-1)?.id ?? '';
    }
  };

  private async _getMatchedContexts() {
    const docContexts = new Map<
      string,
      { docId: string; docContent: string }
    >();

    this.chips.forEach(chip => {
      if (isDocChip(chip) && !!chip.markdown?.value) {
        docContexts.set(chip.docId, {
          docId: chip.docId,
          docContent: chip.markdown.value,
        });
      }
    });

    const docs: BlockSuitePresets.AIDocContextOption[] = Array.from(
      docContexts.values()
    ).map(doc => {
      const docMeta = this.docDisplayConfig.getDocMeta(doc.docId);
      const docTitle = this.docDisplayConfig.getTitle(doc.docId);
      const tags = docMeta?.tags
        ? docMeta.tags
            .map(tagId => this.docDisplayConfig.getTagTitle(tagId))
            .join(',')
        : '';
      return {
        docId: doc.docId,
        docContent: doc.docContent,
        docTitle,
        tags,
        createDate: docMeta?.createDate
          ? new Date(docMeta.createDate).toISOString()
          : '',
        updatedDate: docMeta?.updatedDate
          ? new Date(docMeta.updatedDate).toISOString()
          : '',
      };
    });

    return { docs, files: [] };
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ai-chat-input': AIChatInput;
  }
}
