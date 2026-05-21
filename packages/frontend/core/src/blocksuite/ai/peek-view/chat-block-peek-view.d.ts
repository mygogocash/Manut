import type { AIDraftService, AIToolsConfigService } from '@affine/core/modules/ai-button';
import type { AIModelService } from '@affine/core/modules/ai-button/services/models';
import type { ServerService, SubscriptionService } from '@affine/core/modules/cloud';
import type { WorkspaceDialogService } from '@affine/core/modules/dialogs';
import type { FeatureFlagService } from '@affine/core/modules/feature-flag';
import type { CopilotChatHistoryFragment } from '@affine/graphql';
import type { EditorHost } from '@blocksuite/affine/std';
import { LitElement, nothing, type PropertyValues } from 'lit';
import { type AIChatBlockModel } from '../blocks';
import type { SearchMenuConfig } from '../components/ai-chat-add-context';
import type { DocDisplayConfig } from '../components/ai-chat-chips';
import type { AIReasoningConfig } from '../components/ai-chat-input';
import type { ChatMessage } from '../components/ai-chat-messages';
import type { ChatContext } from './types';
export declare class AIChatBlockPeekView extends LitElement {
    static styles: import("lit").CSSResult;
    private get _modeService();
    private get _sessionId();
    private get historyMessagesString();
    private get blockId();
    private get rootDocId();
    private get rootWorkspaceId();
    private get _isReasoningActive();
    private _textRendererOptions;
    private _forkBlockId;
    private readonly _deserializeHistoryChatMessages;
    private readonly _constructBranchChatBlockMessages;
    private readonly _resetContext;
    private readonly initSession;
    private readonly createForkSession;
    private readonly _onChatSuccess;
    /**
     * Create a new AI chat block based on the current session and history messages
     */
    private readonly _createForkChatBlock;
    /**
     * Update the current chat messages with the new message
     */
    updateChatBlockMessages: () => Promise<void>;
    updateContext: (context: Partial<ChatContext>) => void;
    private readonly onEmbeddingProgressChange;
    /**
     * Clean current chat messages and delete the newly created AI chat block
     */
    private readonly _onHistoryCleared;
    private readonly _scrollToEnd;
    private readonly _throttledScrollToEnd;
    /**
     * Retry the last chat message
     */
    retry: () => Promise<void>;
    CurrentMessages: (currentMessages: ChatMessage[]) => import("lit-html").TemplateResult<1> | typeof nothing;
    connectedCallback(): void;
    firstUpdated(): void;
    protected updated(changedProperties: PropertyValues): void;
    render(): import("lit-html").TemplateResult<1> | typeof nothing;
    accessor _chatMessagesContainer: HTMLDivElement;
    accessor blockModel: AIChatBlockModel;
    accessor host: EditorHost;
    accessor reasoningConfig: AIReasoningConfig;
    accessor serverService: ServerService;
    accessor docDisplayConfig: DocDisplayConfig;
    accessor searchMenuConfig: SearchMenuConfig;
    accessor affineFeatureFlagService: FeatureFlagService;
    accessor affineWorkspaceDialogService: WorkspaceDialogService;
    accessor aiDraftService: AIDraftService;
    accessor aiToolsConfigService: AIToolsConfigService;
    accessor aiModelService: AIModelService;
    accessor subscriptionService: SubscriptionService;
    accessor onAISubscribe: () => Promise<void>;
    accessor _historyMessages: ChatMessage[];
    accessor chatContext: ChatContext;
    accessor embeddingProgress: [number, number];
    accessor session: CopilotChatHistoryFragment | null | undefined;
    accessor forkSession: CopilotChatHistoryFragment | null | undefined;
}
declare global {
    interface HTMLElementTagNameMap {
        'ai-chat-block-peek-view': AIChatBlockPeekView;
    }
}
export declare const AIChatBlockPeekViewTemplate: (blockModel: AIChatBlockModel, host: EditorHost, docDisplayConfig: DocDisplayConfig, searchMenuConfig: SearchMenuConfig, reasoningConfig: AIReasoningConfig, serverService: ServerService, affineFeatureFlagService: FeatureFlagService, affineWorkspaceDialogService: WorkspaceDialogService, aiDraftService: AIDraftService, aiToolsConfigService: AIToolsConfigService, subscriptionService: SubscriptionService, aiModelService: AIModelService, onAISubscribe: (() => Promise<void>) | undefined) => import("lit-html").TemplateResult<1>;
//# sourceMappingURL=chat-block-peek-view.d.ts.map