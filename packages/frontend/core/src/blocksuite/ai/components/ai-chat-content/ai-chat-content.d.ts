import type { AIDraftService, AIToolsConfigService } from '@affine/core/modules/ai-button';
import type { AIModelService } from '@affine/core/modules/ai-button/services/models';
import type { ServerService, SubscriptionService } from '@affine/core/modules/cloud';
import type { WorkspaceDialogService } from '@affine/core/modules/dialogs';
import type { FeatureFlagService } from '@affine/core/modules/feature-flag';
import type { PeekViewService } from '@affine/core/modules/peek-view';
import type { AppThemeService } from '@affine/core/modules/theme';
import type { ContextEmbedStatus, CopilotChatHistoryFragment } from '@affine/graphql';
import { type EditorHost } from '@blocksuite/affine/std';
import type { ExtensionType } from '@blocksuite/affine/store';
import type { NotificationService } from '@blocksuite/affine-shared/services';
import { type Signal } from '@preact/signals-core';
import { type PropertyValues, type TemplateResult } from 'lit';
import type { SearchMenuConfig } from '../ai-chat-add-context';
import type { DocDisplayConfig } from '../ai-chat-chips';
import type { AIReasoningConfig } from '../ai-chat-input';
import { type HistoryMessage } from '../ai-chat-messages';
import type { ChatContextValue } from './type';
declare const AIChatContent_base: any;
export declare class AIChatContent extends AIChatContent_base {
    static styles: import("lit").CSSResult;
    accessor independentMode: boolean | undefined;
    accessor onboardingOffsetY: number;
    accessor host: EditorHost | null | undefined;
    accessor session: CopilotChatHistoryFragment | null | undefined;
    accessor createSession: () => Promise<CopilotChatHistoryFragment | undefined>;
    accessor workspaceId: string;
    accessor docId: string | undefined;
    accessor reasoningConfig: AIReasoningConfig;
    accessor searchMenuConfig: SearchMenuConfig;
    accessor docDisplayConfig: DocDisplayConfig;
    accessor extensions: ExtensionType[];
    accessor serverService: ServerService;
    accessor affineFeatureFlagService: FeatureFlagService;
    accessor affineWorkspaceDialogService: WorkspaceDialogService;
    accessor affineThemeService: AppThemeService;
    accessor notificationService: NotificationService;
    accessor aiDraftService: AIDraftService | undefined;
    accessor aiToolsConfigService: AIToolsConfigService;
    accessor aiModelService: AIModelService;
    accessor onEmbeddingProgressChange: ((count: Record<ContextEmbedStatus, number>) => void) | undefined;
    accessor onContextChange: (context: Partial<ChatContextValue>) => void;
    accessor onOpenDoc: (docId: string, sessionId?: string) => void;
    /**
     * Optional click handler for the inline "recent chats" strip rendered
     * below the composer on the empty state. When omitted, the strip is
     * hidden — keeps this component decoupled from the workspace router.
     */
    accessor onOpenSession: ((sessionId: string) => void) | undefined;
    accessor width: Signal<number | undefined> | undefined;
    accessor peekViewService: PeekViewService;
    accessor subscriptionService: SubscriptionService;
    accessor onAISubscribe: () => Promise<void>;
    accessor chatContextValue: ChatContextValue;
    accessor isHistoryLoading: boolean;
    private accessor showPreviewPanel;
    private accessor previewPanelContent;
    /**
     * Last 5 recent sessions for the inline strip. Only populated when
     * `onOpenSession` is provided (Manut's dedicated /chat page) and
     * the chat is currently empty. Plain field shape keeps this lit-friendly
     * — Lit only re-renders on @state property writes, so we replace the
     * array reference rather than mutate.
     */
    private accessor recentSessions;
    private readonly chatMessagesRef;
    private updateHistoryCounter;
    private lastScrollTop;
    get messages(): HistoryMessage[];
    get showActions(): boolean;
    private readonly updateHistory;
    private readonly updateActions;
    private readonly updateContext;
    private readonly updateDraft;
    private readonly initChatContent;
    /**
     * Load up to 5 recent sessions for the empty-state strip. Excludes the
     * current session if present so we don't show a "jump to where you
     * already are" item. Failures are non-fatal (just logged) — the strip
     * silently disappears on error.
     */
    private readonly _loadRecentSessions;
    private static _truncateTitle;
    protected firstUpdated(): void;
    private _scrollListenersInitialized;
    private _initializeScrollListeners;
    protected updated(changedProperties: PropertyValues): void;
    openPreviewPanel(content?: TemplateResult<1>): void;
    closePreviewPanel(destroyContent?: boolean): void;
    get isPreviewPanelOpen(): boolean;
    connectedCallback(): void;
    /**
     * Click handler for the suggested-prompt cards rendered below the composer.
     * In editor mode dispatches via AIProvider; in independent (sidebar/page)
     * mode walks down to the composer's textarea and fills it directly.
     */
    private _fillSuggestion;
    render(): TemplateResult<1>;
}
export {};
//# sourceMappingURL=ai-chat-content.d.ts.map