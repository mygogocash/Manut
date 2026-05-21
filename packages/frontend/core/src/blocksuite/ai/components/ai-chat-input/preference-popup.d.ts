import type { AIToolsConfigService } from '@affine/core/modules/ai-button';
import type { AIModelService } from '@affine/core/modules/ai-button/services/models';
import type { ServerService, SubscriptionService } from '@affine/core/modules/cloud';
import { type CopilotChatHistoryFragment } from '@affine/graphql';
import type { NotificationService } from '@blocksuite/affine-shared/services';
type ChatPermissionMode = 'read-only' | 'edit-doc' | 'full-agent';
declare const ChatInputPreference_base: any;
export declare class ChatInputPreference extends ChatInputPreference_base {
    static styles: import("lit").CSSResult;
    accessor session: CopilotChatHistoryFragment | null | undefined;
    accessor extendedThinking: boolean;
    accessor onExtendedThinkingChange: ((extendedThinking: boolean) => void) | undefined;
    accessor serverService: ServerService;
    accessor toolsConfigService: AIToolsConfigService;
    accessor notificationService: NotificationService;
    accessor subscriptionService: SubscriptionService;
    accessor aiModelService: AIModelService;
    accessor onAISubscribe: () => Promise<void>;
    model: import("@preact/signals-core").ReadonlySignal<any>;
    currentMode: import("@preact/signals-core").ReadonlySignal<ChatPermissionMode>;
    private get _workspaceId();
    private _getCurrentChatMode;
    private _getCurrentEnabledTools;
    private _setChatMode;
    private _toggleTool;
    openPreference(e: Event): void;
    render(): import("lit-html").TemplateResult<1>;
}
export {};
//# sourceMappingURL=preference-popup.d.ts.map