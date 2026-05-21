import type { AIDraftService, AIToolsConfigService } from '@affine/core/modules/ai-button';
import type { AIModelService } from '@affine/core/modules/ai-button/services/models';
import type { ServerService, SubscriptionService } from '@affine/core/modules/cloud';
import type { FeatureFlagService } from '@affine/core/modules/feature-flag';
import type { CopilotChatHistoryFragment } from '@affine/graphql';
import type { EditorHost } from '@blocksuite/affine/std';
import type { NotificationService } from '@blocksuite/affine-shared/services';
import { type PropertyValues } from 'lit';
import { type OutputFormat } from '../../utils/format-prompt';
import type { SearchMenuConfig } from '../ai-chat-add-context';
import type { ChatChip, DocDisplayConfig } from '../ai-chat-chips/type';
import type { AIChatInputContext, AIReasoningConfig } from './type';
declare const AIChatInput_base: any;
export declare class AIChatInput extends AIChatInput_base {
    static styles: import("lit").CSSResult;
    accessor independentMode: boolean | undefined;
    accessor host: EditorHost | null | undefined;
    accessor workspaceId: string;
    accessor docId: string | undefined;
    accessor session: CopilotChatHistoryFragment | null | undefined;
    accessor isContextProcessing: boolean | undefined;
    accessor imagePreviewGrid: HTMLDivElement | null;
    accessor textarea: HTMLTextAreaElement;
    accessor isInputEmpty: boolean;
    accessor focused: boolean;
    accessor chatContextValue: AIChatInputContext;
    accessor chips: ChatChip[];
    accessor createSession: () => Promise<CopilotChatHistoryFragment | undefined>;
    accessor updateContext: (context: Partial<AIChatInputContext>) => void;
    accessor addImages: (images: File[]) => void;
    accessor addChip: (chip: ChatChip, silent?: boolean) => Promise<void>;
    accessor reasoningConfig: AIReasoningConfig;
    accessor docDisplayConfig: DocDisplayConfig;
    accessor searchMenuConfig: SearchMenuConfig;
    accessor serverService: ServerService;
    accessor aiDraftService: AIDraftService | undefined;
    accessor aiToolsConfigService: AIToolsConfigService;
    accessor affineFeatureFlagService: FeatureFlagService;
    accessor notificationService: NotificationService;
    accessor subscriptionService: SubscriptionService;
    accessor aiModelService: AIModelService;
    accessor onAISubscribe: () => Promise<void>;
    accessor isRootSession: boolean;
    accessor onChatSuccess: (() => void) | undefined;
    accessor trackOptions: BlockSuitePresets.TrackerOptions | undefined;
    accessor testId: string;
    accessor portalContainer: HTMLElement | null;
    accessor floatingMode: boolean;
    accessor selectedFormat: OutputFormat;
    accessor onFormatChange: ((format: OutputFormat) => void) | undefined;
    private get _isReasoningActive();
    connectedCallback(): void;
    protected firstUpdated(changedProperties: PropertyValues): void;
    protected render(): import("lit-html").TemplateResult<1>;
    private get isSendDisabled();
    private readonly _handlePointerDown;
    private _mentionAbort;
    private _mentionedMembers;
    private readonly _handleInput;
    private readonly _handleKeyDown;
    /**
     * Compute the current `@query` segment (if any) at the cursor and either
     * open the popup, update its query, or close it.
     */
    private _syncMentionState;
    /**
     * Returns the active `@…` mention segment under the cursor, or null if
     * cursor is not inside a valid mention trigger position.
     */
    private _currentMentionSegment;
    private _currentMentionPopup;
    private _openMentionPopup;
    private _closeMentionPopup;
    /**
     * Replace the active `@query` segment in the textarea with `replacement`.
     * Returns the new cursor position.
     */
    private _replaceMentionSegment;
    private readonly _onMentionSelectDoc;
    private readonly _onMentionSelectMember;
    private readonly _handlePaste;
    private readonly _handleAbort;
    private readonly _toggleReasoning;
    private readonly _handleFormatChange;
    private readonly _handleImageRemove;
    private readonly _onTextareaSend;
    send: (text: string) => Promise<void>;
    private readonly _preUpdateMessages;
    private readonly _postUpdateMessages;
    private _getMatchedContexts;
}
declare global {
    interface HTMLElementTagNameMap {
        'ai-chat-input': AIChatInput;
    }
}
export {};
//# sourceMappingURL=ai-chat-input.d.ts.map