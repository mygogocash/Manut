import type {
  AIDraftService,
  AIToolsConfigService,
} from '@affine/core/modules/ai-button';
import type { AIDraftState } from '@affine/core/modules/ai-button/services/ai-draft';
import type { AIModelService } from '@affine/core/modules/ai-button/services/models';
import type {
  ServerService,
  SubscriptionService,
} from '@affine/core/modules/cloud';
import type { WorkspaceDialogService } from '@affine/core/modules/dialogs';
import type { FeatureFlagService } from '@affine/core/modules/feature-flag';
import type { PeekViewService } from '@affine/core/modules/peek-view';
import type { AppThemeService } from '@affine/core/modules/theme';
import type {
  ContextEmbedStatus,
  CopilotChatHistoryFragment,
} from '@affine/graphql';
import { SignalWatcher, WithDisposable } from '@blocksuite/affine/global/lit';
import { type EditorHost, ShadowlessElement } from '@blocksuite/affine/std';
import type { ExtensionType } from '@blocksuite/affine/store';
import type { NotificationService } from '@blocksuite/affine-shared/services';
import { type Signal } from '@preact/signals-core';
import { css, html, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { createRef, type Ref, ref } from 'lit/directives/ref.js';
import { repeat } from 'lit/directives/repeat.js';
import { styleMap } from 'lit/directives/style-map.js';
import { pick } from 'lodash-es';

import { type AIChatParams, AIProvider } from '../../provider/ai-provider';
import { extractSelectedContent } from '../../utils/extract';
import { HISTORY_IMAGE_ACTIONS } from '../../utils/history-image-actions';
import type { SearchMenuConfig } from '../ai-chat-add-context';
import type { DocDisplayConfig } from '../ai-chat-chips';
import type { AIReasoningConfig } from '../ai-chat-input';
import {
  type AIChatMessages,
  type ChatAction,
  type ChatMessage,
  type HistoryMessage,
  isChatMessage,
} from '../ai-chat-messages';
import { SUGGESTED_PROMPTS } from '../ai-chat-messages/suggested-prompts-config';
import type { ChatContextValue } from './type';

const DEFAULT_CHAT_CONTEXT_VALUE: ChatContextValue = {
  quote: '',
  images: [],
  abortController: null,
  messages: [],
  status: 'idle',
  error: null,
  markdown: '',
  snapshot: null,
  attachments: [],
  combinedElementsMarkdown: null,
  docs: [],
  html: null,
};

export function getChatPanelMainClasses(options: {
  independentMode: boolean;
  hasMessages: boolean;
}) {
  return {
    'chat-panel-main': true,
    'independent-mode': options.independentMode,
    'no-message': !options.hasMessages,
  };
}

export class AIChatContent extends SignalWatcher(
  WithDisposable(ShadowlessElement)
) {
  static override styles = css`
    ai-chat-content {
      display: flex;
      flex-direction: column;
      justify-content: center;
      height: 100%;

      ai-chat-messages {
        flex: 1;
        overflow-y: auto;
        padding: 0 var(--h-padding);
        transition:
          flex-grow 0.32s cubic-bezier(0.07, 0.83, 0.46, 1),
          padding-top 0.32s ease,
          padding-bottom 0.32s ease;
      }
      ai-chat-messages.independent-mode.no-message {
        flex-grow: 0;
        flex-shrink: 0;
        overflow-y: visible;
      }
    }
    chat-panel-split-view {
      height: 100%;
      width: 100%;
      container-type: inline-size;
      container-name: chat-panel-split-view;
    }
    .chat-panel-main {
      --h-padding: 8px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      height: 100%;
      width: 100%;
      padding: 8px calc(24px - var(--h-padding)) 0 calc(24px - var(--h-padding));
      max-width: 800px;
      margin: 0 auto;
    }
    .chat-panel-main.independent-mode.no-message {
      justify-content: flex-start;
      overflow-y: auto;
      padding-top: 24px;
      padding-bottom: 16px;
      scrollbar-width: thin;
    }
    .chat-panel-main.independent-mode.no-message ai-chat-messages {
      flex: 0 0 auto;
      overflow: visible;
      padding-bottom: 10px;
    }
    .chat-panel-main.independent-mode.no-message ai-chat-composer {
      flex: 0 0 auto;
    }

    ai-chat-composer {
      padding: 0 var(--h-padding);
    }

    /* Suggested prompts grid — appears BELOW the composer when the chat
       has no messages yet. Mirrors Notion's layout (input first, prompts
       below). The cards reuse the visual treatment from
       ai-chat-messages/suggested-prompts-config.ts. */
    .ai-chat-suggestions {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
      margin-top: 16px;
      padding: 0 var(--h-padding);
    }
    @container chat-panel-split-view (width < 540px) {
      .ai-chat-suggestions {
        grid-template-columns: 1fr;
      }
    }
    .ai-chat-suggestion-card {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      border: 1px solid var(--affine-border-color, rgba(0, 0, 0, 0.08));
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      line-height: 20px;
      color: var(--affine-text-primary-color);
      background: transparent;
      transition:
        background 0.15s ease,
        border-color 0.15s ease;
    }
    .ai-chat-suggestion-card:hover {
      background: var(--affine-hover-color, rgba(0, 0, 0, 0.04));
      border-color: var(--affine-border-color-hover, rgba(0, 0, 0, 0.16));
    }
    .ai-chat-suggestion-card-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      flex-shrink: 0;
      color: var(--affine-icon-color);
    }
    .ai-chat-suggestion-card-text {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* Recent chats strip — last 5 sessions, horizontally scrollable.
       Shown only on the empty state (no messages). Hidden on small
       viewports per spec. Click jumps to that session. */
    .ai-chat-recents {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-top: 20px;
      padding: 0 var(--h-padding);
    }
    .ai-chat-recents-title {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--affine-text-secondary-color);
      font-weight: 500;
      padding-left: 2px;
    }
    .ai-chat-recents-row {
      display: flex;
      gap: 6px;
      overflow-x: auto;
      scrollbar-width: thin;
      padding-bottom: 4px;
    }
    .ai-chat-recents-row::-webkit-scrollbar {
      height: 4px;
    }
    .ai-chat-recents-row::-webkit-scrollbar-thumb {
      background: var(--affine-border-color, rgba(0, 0, 0, 0.12));
      border-radius: 2px;
    }
    .ai-chat-recent-item {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 10px;
      border: 1px solid var(--affine-border-color, rgba(0, 0, 0, 0.08));
      border-radius: 999px;
      background: transparent;
      cursor: pointer;
      flex-shrink: 0;
      font-size: 12px;
      line-height: 18px;
      color: var(--affine-text-primary-color);
      max-width: 220px;
      transition:
        background 0.15s ease,
        border-color 0.15s ease;
    }
    .ai-chat-recent-item:hover {
      background: var(--affine-hover-color, rgba(0, 0, 0, 0.04));
      border-color: var(--affine-border-color-hover, rgba(0, 0, 0, 0.16));
    }
    .ai-chat-recent-item-icon {
      display: inline-flex;
      width: 14px;
      height: 14px;
      flex-shrink: 0;
      color: var(--affine-icon-color);
    }
    .ai-chat-recent-item-text {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 180px;
    }
    @container chat-panel-split-view (width < 640px) {
      .ai-chat-recents {
        display: none;
      }
    }

    @container chat-panel-split-view (width < 540px) {
      .chat-panel-main {
        padding: 8px calc(12px - var(--h-padding)) 0
          calc(12px - var(--h-padding));
      }
      .chat-panel-main.independent-mode.no-message {
        padding-top: 20px;
        padding-bottom: 12px;
      }
    }
  `;

  @property({ attribute: false })
  accessor independentMode: boolean | undefined;

  @property({ attribute: false })
  accessor onboardingOffsetY!: number;

  @property({ attribute: false })
  accessor host: EditorHost | null | undefined;

  @property({ attribute: false })
  accessor session!: CopilotChatHistoryFragment | null | undefined;

  @property({ attribute: false })
  accessor createSession!: () => Promise<
    CopilotChatHistoryFragment | undefined
  >;

  @property({ attribute: false })
  accessor workspaceId!: string;

  @property({ attribute: false })
  accessor docId: string | undefined;

  @property({ attribute: false })
  accessor reasoningConfig!: AIReasoningConfig;

  @property({ attribute: false })
  accessor searchMenuConfig!: SearchMenuConfig;

  @property({ attribute: false })
  accessor docDisplayConfig!: DocDisplayConfig;

  @property({ attribute: false })
  accessor extensions!: ExtensionType[];

  @property({ attribute: false })
  accessor serverService!: ServerService;

  @property({ attribute: false })
  accessor affineFeatureFlagService!: FeatureFlagService;

  @property({ attribute: false })
  accessor affineWorkspaceDialogService!: WorkspaceDialogService;

  @property({ attribute: false })
  accessor affineThemeService!: AppThemeService;

  @property({ attribute: false })
  accessor notificationService!: NotificationService;

  @property({ attribute: false })
  accessor aiDraftService: AIDraftService | undefined;

  @property({ attribute: false })
  accessor aiToolsConfigService!: AIToolsConfigService;

  @property({ attribute: false })
  accessor aiModelService!: AIModelService;

  @property({ attribute: false })
  accessor onEmbeddingProgressChange:
    | ((count: Record<ContextEmbedStatus, number>) => void)
    | undefined;

  @property({ attribute: false })
  accessor onContextChange!: (context: Partial<ChatContextValue>) => void;

  @property({ attribute: false })
  accessor onOpenDoc!: (docId: string, sessionId?: string) => void;

  /**
   * Optional click handler for the inline "recent chats" strip rendered
   * below the composer on the empty state. When omitted, the strip is
   * hidden — keeps this component decoupled from the workspace router.
   */
  @property({ attribute: false })
  accessor onOpenSession: ((sessionId: string) => void) | undefined;

  @property({ attribute: false })
  accessor width: Signal<number | undefined> | undefined;

  @property({ attribute: false })
  accessor peekViewService!: PeekViewService;

  @property({ attribute: false })
  accessor subscriptionService!: SubscriptionService;

  @property({ attribute: false })
  accessor onAISubscribe!: () => Promise<void>;

  @state()
  accessor chatContextValue: ChatContextValue = DEFAULT_CHAT_CONTEXT_VALUE;

  @state()
  accessor isHistoryLoading = false;

  @state()
  private accessor showPreviewPanel = false;

  @state()
  private accessor previewPanelContent: TemplateResult<1> | null = null;

  /**
   * Last 5 recent sessions for the inline strip. Only populated when
   * `onOpenSession` is provided (Manut's dedicated /chat page) and
   * the chat is currently empty. Plain field shape keeps this lit-friendly
   * — Lit only re-renders on @state property writes, so we replace the
   * array reference rather than mutate.
   */
  @state()
  private accessor recentSessions: Array<{
    sessionId: string;
    title: string | null;
  }> = [];

  private readonly chatMessagesRef: Ref<AIChatMessages> =
    createRef<AIChatMessages>();

  // request counter to track the latest request
  private updateHistoryCounter = 0;

  private lastScrollTop: number | undefined;

  get messages() {
    return this.chatContextValue.messages.filter(item => {
      return (
        isChatMessage(item) ||
        item.messages?.length === 3 ||
        (HISTORY_IMAGE_ACTIONS.includes(item.action) &&
          item.messages?.length === 2)
      );
    });
  }

  get showActions() {
    return false;
  }

  private readonly updateHistory = async () => {
    const currentRequest = ++this.updateHistoryCounter;
    if (!AIProvider.histories) {
      return;
    }

    const sessionId = this.session?.sessionId;
    const [histories, actions] = await Promise.all([
      sessionId
        ? AIProvider.histories.chats(this.workspaceId, sessionId)
        : Promise.resolve([]),
      this.docId && this.showActions
        ? AIProvider.histories.actions(this.workspaceId, this.docId)
        : Promise.resolve([]),
    ]);

    // Check if this is still the latest request
    if (currentRequest !== this.updateHistoryCounter) {
      return;
    }

    const messages: HistoryMessage[] = this.chatContextValue.messages
      .slice()
      .filter(isChatMessage);

    const chatActions = (actions || []) as ChatAction[];
    messages.push(...chatActions);

    const chatMessages = (histories?.[0]?.messages || []) as ChatMessage[];
    messages.push(...chatMessages);

    this.updateContext({
      messages: messages.sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      ),
    });
  };

  private readonly updateActions = async () => {
    if (!this.docId || !AIProvider.histories || !this.showActions) {
      return;
    }
    const actions = await AIProvider.histories.actions(
      this.workspaceId,
      this.docId
    );
    if (actions && actions.length) {
      const chatMessages = this.chatContextValue.messages.filter(message =>
        isChatMessage(message)
      );
      const chatActions = actions as ChatAction[];
      const messages: HistoryMessage[] = [...chatMessages, ...chatActions];
      this.updateContext({
        messages: messages.sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        ),
      });
    }
  };

  private readonly updateContext = (context: Partial<ChatContextValue>) => {
    this.chatContextValue = { ...this.chatContextValue, ...context };
    this.onContextChange?.(context);
    this.updateDraft(context).catch(console.error);
  };

  private readonly updateDraft = async (context: Partial<ChatContextValue>) => {
    if (!this.aiDraftService) {
      return;
    }
    const draft: Partial<AIDraftState> = pick(context, [
      'quote',
      'images',
      'markdown',
    ]);
    if (!Object.keys(draft).length) {
      return;
    }
    await this.aiDraftService.setDraft(draft);
  };

  private readonly initChatContent = async () => {
    this.isHistoryLoading = true;
    await this.updateHistory();
    this.isHistoryLoading = false;
  };

  /**
   * Load up to 5 recent sessions for the empty-state strip. Excludes the
   * current session if present so we don't show a "jump to where you
   * already are" item. Failures are non-fatal (just logged) — the strip
   * silently disappears on error.
   */
  private readonly _loadRecentSessions = async () => {
    if (!this.onOpenSession) return;
    if (!AIProvider.session) return;
    if (!this.workspaceId) return;
    try {
      const sessions = await AIProvider.session.getRecentSessions(
        this.workspaceId,
        6 // request 6 so we can drop the current one and still show 5
      );
      if (!sessions) return;
      const currentId = this.session?.sessionId;
      this.recentSessions = sessions
        .filter(s => s.sessionId !== currentId)
        .slice(0, 5)
        .map(s => ({
          sessionId: s.sessionId,
          // Normalise: API field is `title`. May be null while backend
          // hasn't generated one yet — fall back to a placeholder.
          title: (s as { title?: string | null }).title ?? null,
        }));
    } catch (err) {
      console.warn('[ai-chat-content] failed to load recent sessions', err);
    }
  };

  private static _truncateTitle(t: string | null) {
    if (!t || !t.trim()) return 'Untitled chat';
    const trimmed = t.trim();
    return trimmed.length > 24 ? trimmed.slice(0, 23).trimEnd() + '…' : trimmed;
  }

  protected override firstUpdated(): void {}

  private _scrollListenersInitialized = false;
  private _initializeScrollListeners() {
    const chatMessages = this.chatMessagesRef.value;
    if (chatMessages) {
      chatMessages.updateComplete
        .then(() => {
          chatMessages.addEventListener('scrollend', () => {
            this.lastScrollTop = chatMessages.scrollTop;
          });
          this._scrollListenersInitialized = true;
        })
        .catch(console.error);
    }
  }

  protected override updated(changedProperties: PropertyValues) {
    // restore pinned chat scroll position
    if (
      changedProperties.has('host') &&
      this.session?.pinned &&
      this.lastScrollTop !== undefined
    ) {
      this.chatMessagesRef.value?.scrollToPos(this.lastScrollTop);
    }

    if (!this._scrollListenersInitialized) {
      this._initializeScrollListeners();
    }
  }

  public openPreviewPanel(content?: TemplateResult<1>) {
    this.showPreviewPanel = true;
    if (content) this.previewPanelContent = content;
    AIProvider.slots.previewPanelOpenChange.next(true);
  }

  public closePreviewPanel(destroyContent: boolean = false) {
    this.showPreviewPanel = false;
    if (destroyContent) this.previewPanelContent = null;
    AIProvider.slots.previewPanelOpenChange.next(false);
  }

  public get isPreviewPanelOpen() {
    return this.showPreviewPanel;
  }

  override connectedCallback() {
    super.connectedCallback();

    this.initChatContent().catch(console.error);
    this._loadRecentSessions().catch(console.error);

    if (this.aiDraftService) {
      this.aiDraftService
        .getDraft()
        .then(draft => {
          this.chatContextValue = {
            ...this.chatContextValue,
            ...draft,
          };
        })
        .catch(console.error);
    }

    // revalidate subscription to get the latest status
    this.subscriptionService.subscription.revalidate();

    this._disposables.add(
      AIProvider.slots.actions.subscribe(({ event }) => {
        const { status } = this.chatContextValue;
        if (
          event === 'finished' &&
          (status === 'idle' || status === 'success')
        ) {
          this.updateActions().catch(console.error);
        }
      })
    );

    this._disposables.add(
      AIProvider.slots.requestOpenWithChat.subscribe(
        (params: AIChatParams | null) => {
          if (!params) {
            return;
          }
          if (this.host === params.host) {
            if (params.fromAnswer && params.context) {
              this.updateContext(params.context);
            } else {
              extractSelectedContent(params.host)
                .then(context => {
                  if (!context) return;
                  this.updateContext(context);
                })
                .catch(console.error);
            }
          }
          AIProvider.slots.requestOpenWithChat.next(null);
        }
      )
    );
  }

  /**
   * Click handler for the suggested-prompt cards rendered below the composer.
   * In editor mode dispatches via AIProvider; in independent (sidebar/page)
   * mode walks down to the composer's textarea and fills it directly.
   */
  private _fillSuggestion(text: string) {
    if (this.host) {
      AIProvider.slots.requestOpenWithChat.next({
        host: this.host,
        input: text,
      });
      return;
    }
    const input = this.querySelector<HTMLTextAreaElement>(
      '[data-testid="chat-panel-input"]'
    );
    if (!input) return;
    input.value = text;
    input.focus();
    input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  }

  override render() {
    const left = html` <ai-chat-messages
        class=${classMap({
          'ai-chat-messages': true,
          'independent-mode': !!this.independentMode,
          'no-message': this.messages.length === 0,
        })}
        ${ref(this.chatMessagesRef)}
        .host=${this.host}
        .workspaceId=${this.workspaceId}
        .docId=${this.docId}
        .session=${this.session}
        .createSession=${this.createSession}
        .chatContextValue=${this.chatContextValue}
        .updateContext=${this.updateContext}
        .isHistoryLoading=${this.isHistoryLoading}
        .extensions=${this.extensions}
        .affineFeatureFlagService=${this.affineFeatureFlagService}
        .affineThemeService=${this.affineThemeService}
        .notificationService=${this.notificationService}
        .aiToolsConfigService=${this.aiToolsConfigService}
        .reasoningConfig=${this.reasoningConfig}
        .width=${this.width}
        .independentMode=${this.independentMode}
        .messages=${this.messages}
        .docDisplayService=${this.docDisplayConfig}
        .peekViewService=${this.peekViewService}
        .onOpenDoc=${this.onOpenDoc}
      ></ai-chat-messages>
      <ai-chat-composer
        style=${styleMap({
          [this.onboardingOffsetY > 0 ? 'paddingTop' : 'paddingBottom']:
            `${this.messages.length === 0 ? Math.abs(this.onboardingOffsetY) * 2 : 0}px`,
        })}
        .affineFeatureFlagService=${this.affineFeatureFlagService}
        .independentMode=${this.independentMode}
        .host=${this.host}
        .workspaceId=${this.workspaceId}
        .docId=${this.docId}
        .session=${this.session}
        .createSession=${this.createSession}
        .chatContextValue=${this.chatContextValue}
        .updateContext=${this.updateContext}
        .onEmbeddingProgressChange=${this.onEmbeddingProgressChange}
        .reasoningConfig=${this.reasoningConfig}
        .docDisplayConfig=${this.docDisplayConfig}
        .searchMenuConfig=${this.searchMenuConfig}
        .serverService=${this.serverService}
        .affineWorkspaceDialogService=${this.affineWorkspaceDialogService}
        .notificationService=${this.notificationService}
        .aiDraftService=${this.aiDraftService}
        .aiToolsConfigService=${this.aiToolsConfigService}
        .subscriptionService=${this.subscriptionService}
        .aiModelService=${this.aiModelService}
        .onAISubscribe=${this.onAISubscribe}
        .trackOptions=${{
          where: 'chat-panel',
          control: 'chat-send',
        }}
      ></ai-chat-composer>
      ${this.messages.length === 0
        ? html`<div class="ai-chat-suggestions">
            ${repeat(
              SUGGESTED_PROMPTS,
              prompt => prompt.text,
              prompt =>
                html`<button
                  class="ai-chat-suggestion-card"
                  data-testid="ai-suggested-prompt"
                  @click=${() => this._fillSuggestion(prompt.text)}
                >
                  <span class="ai-chat-suggestion-card-icon"
                    >${prompt.icon}</span
                  >
                  <span class="ai-chat-suggestion-card-text"
                    >${prompt.text}</span
                  >
                </button>`
            )}
          </div>`
        : null}
      ${this.messages.length === 0 &&
      this.onOpenSession &&
      this.recentSessions.length > 0
        ? html`<div class="ai-chat-recents" data-testid="ai-chat-recents">
            <div class="ai-chat-recents-title">Recent chats</div>
            <div class="ai-chat-recents-row">
              ${repeat(
                this.recentSessions,
                s => s.sessionId,
                s =>
                  html`<button
                    class="ai-chat-recent-item"
                    data-testid="ai-chat-recent-item"
                    @click=${() => this.onOpenSession?.(s.sessionId)}
                    title=${s.title ?? 'Untitled chat'}
                  >
                    <span class="ai-chat-recent-item-icon">
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 14 14"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M2 4.5C2 3.39543 2.89543 2.5 4 2.5H10C11.1046 2.5 12 3.39543 12 4.5V8C12 9.10457 11.1046 10 10 10H6.5L4 12V10H4C2.89543 10 2 9.10457 2 8V4.5Z"
                          stroke="currentColor"
                          stroke-width="1.2"
                          stroke-linejoin="round"
                        />
                      </svg>
                    </span>
                    <span class="ai-chat-recent-item-text"
                      >${AIChatContent._truncateTitle(s.title)}</span
                    >
                  </button>`
              )}
            </div>
          </div>`
        : null}`;

    const right = this.previewPanelContent;

    const hasMessages = this.messages.length > 0;

    return html`<chat-panel-split-view
      .left=${html`<div
        class=${classMap(
          getChatPanelMainClasses({
            independentMode: !!this.independentMode,
            hasMessages,
          })
        )}
      >
        ${left}
      </div>`}
      .right=${right}
      .open=${this.showPreviewPanel}
    >
    </chat-panel-split-view>`;
  }
}
