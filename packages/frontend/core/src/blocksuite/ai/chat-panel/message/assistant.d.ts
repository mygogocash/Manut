import type { FeatureFlagService } from '@affine/core/modules/feature-flag';
import type { PeekViewService } from '@affine/core/modules/peek-view';
import type { AppThemeService } from '@affine/core/modules/theme';
import type { CopilotChatHistoryFragment } from '@affine/graphql';
import { type BlockStdScope, type EditorHost } from '@blocksuite/affine/std';
import type { ExtensionType } from '@blocksuite/affine/store';
import type { NotificationService } from '@blocksuite/affine-shared/services';
import type { Signal } from '@preact/signals-core';
import type { DocDisplayConfig } from '../../components/ai-chat-chips';
import { type ChatMessage, type ChatStatus } from '../../components/ai-chat-messages';
import { type AIError } from '../../provider';
declare const ChatMessageAssistant_base: any;
export declare class ChatMessageAssistant extends ChatMessageAssistant_base {
    static styles: import("lit").CSSResult;
    accessor host: EditorHost | null | undefined;
    accessor std: BlockStdScope | null | undefined;
    accessor item: ChatMessage;
    accessor isLast: boolean;
    accessor status: ChatStatus;
    accessor error: AIError | null;
    accessor extensions: ExtensionType[];
    accessor affineFeatureFlagService: FeatureFlagService;
    accessor affineThemeService: AppThemeService;
    accessor session: CopilotChatHistoryFragment | null | undefined;
    accessor retry: () => void;
    accessor testId: string;
    accessor width: Signal<number | undefined> | undefined;
    accessor notificationService: NotificationService;
    accessor independentMode: boolean | undefined;
    accessor docDisplayService: DocDisplayConfig;
    accessor peekViewService: PeekViewService;
    accessor onOpenDoc: (docId: string, sessionId?: string) => void;
    accessor feedbackRating: 'positive' | 'negative' | 'pending' | null;
    get state(): "finished" | "generating";
    renderHeader(): import("lit-html").TemplateResult<1>;
    renderContent(): import("lit-html").TemplateResult<1>;
    private renderStreamingCursor;
    private renderFeedbackChips;
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
    private handleFeedback;
    private renderWriteChip;
    private renderImages;
    private renderStreamObjects;
    private renderRichText;
    private renderEditorActions;
    protected render(): import("lit-html").TemplateResult<1>;
}
declare global {
    interface HTMLElementTagNameMap {
        'chat-message-assistant': ChatMessageAssistant;
    }
}
export {};
//# sourceMappingURL=assistant.d.ts.map