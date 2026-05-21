import type { ImageSelection } from '@blocksuite/affine/shared/selection';
import { type BlockSelection, type EditorHost, type TextSelection } from '@blocksuite/affine/std';
import type { Store } from '@blocksuite/affine/store';
import type { TemplateResult } from 'lit';
import type { ChatMessage } from '../components/ai-chat-messages';
import { type AIUserInfo } from '../provider';
type Selections = {
    text?: TextSelection;
    blocks?: BlockSelection[];
    images?: ImageSelection[];
};
export type ChatAction = {
    icon: TemplateResult<1>;
    title: string;
    toast: string;
    showWhen: (host: EditorHost) => boolean;
    handler: (host: EditorHost, content: string, currentSelections: Selections, chatSessionId?: string, messageId?: string) => Promise<boolean>;
};
export declare function queryHistoryMessages(workspaceId: string, forkSessionId: string, docId?: string): Promise<{
    id: string | null;
    content: string;
    createdAt: string;
    role: BlockSuitePresets.MessageRole;
    attachments?: string[] | null;
    streamObjects?: import("@affine/graphql").StreamObject[] | null;
}[]>;
export declare function constructUserInfoWithMessages(messages: ChatMessage[], userInfo: AIUserInfo | null): ({
    attachments: never[];
    streamObjects: ({
        type: "text-delta";
        textDelta: string;
    } | {
        type: "reasoning";
        textDelta: string;
    } | {
        type: "tool-call";
        args: Record<string, any>;
        toolCallId: string;
        toolName: string;
    } | {
        type: "tool-result";
        args: Record<string, any>;
        toolCallId: string;
        toolName: string;
        result?: any;
    })[];
    userId: string | undefined;
    userName: string | undefined;
    avatarUrl: string | undefined;
    id: string;
    content: string;
    role: "user" | "assistant";
    createdAt: string;
} | {
    attachments: never[];
    streamObjects: ({
        type: "text-delta";
        textDelta: string;
    } | {
        type: "reasoning";
        textDelta: string;
    } | {
        type: "tool-call";
        args: Record<string, any>;
        toolCallId: string;
        toolName: string;
    } | {
        type: "tool-result";
        args: Record<string, any>;
        toolCallId: string;
        toolName: string;
        result?: any;
    })[];
    userId?: string | undefined;
    userName?: string | undefined;
    avatarUrl?: string | undefined;
    id: string;
    content: string;
    role: "user" | "assistant";
    createdAt: string;
})[];
export declare function constructRootChatBlockMessages(doc: Store, forkSessionId: string): Promise<({
    attachments: never[];
    streamObjects: ({
        type: "text-delta";
        textDelta: string;
    } | {
        type: "reasoning";
        textDelta: string;
    } | {
        type: "tool-call";
        args: Record<string, any>;
        toolCallId: string;
        toolName: string;
    } | {
        type: "tool-result";
        args: Record<string, any>;
        toolCallId: string;
        toolName: string;
        result?: any;
    })[];
    userId: string | undefined;
    userName: string | undefined;
    avatarUrl: string | undefined;
    id: string;
    content: string;
    role: "user" | "assistant";
    createdAt: string;
} | {
    attachments: never[];
    streamObjects: ({
        type: "text-delta";
        textDelta: string;
    } | {
        type: "reasoning";
        textDelta: string;
    } | {
        type: "tool-call";
        args: Record<string, any>;
        toolCallId: string;
        toolName: string;
    } | {
        type: "tool-result";
        args: Record<string, any>;
        toolCallId: string;
        toolName: string;
        result?: any;
    })[];
    userId?: string | undefined;
    userName?: string | undefined;
    avatarUrl?: string | undefined;
    id: string;
    content: string;
    role: "user" | "assistant";
    createdAt: string;
})[]>;
export declare function promptDocTitle(host: EditorHost, autofill?: string): any;
export declare const PAGE_INSERT: {
    icon: TemplateResult<1>;
    title: string;
    showWhen: (host: EditorHost) => boolean;
    toast: string;
    handler: (host: EditorHost, content: string, currentSelections: Selections) => Promise<boolean>;
};
export declare const EDGELESS_INSERT: {
    handler: (host: EditorHost, content: string, currentSelections: Selections) => Promise<boolean>;
    icon: TemplateResult<1>;
    title: string;
    showWhen: (host: EditorHost) => boolean;
    toast: string;
};
export declare const SAVE_AS_DOC: {
    icon: TemplateResult<1>;
    title: string;
    showWhen: () => boolean;
    toast: string;
    handler: (host: EditorHost, content: string) => boolean;
};
export declare const PageEditorActions: (ChatAction | {
    icon: TemplateResult<1>;
    title: string;
    showWhen: () => boolean;
    toast: string;
    handler: (host: EditorHost, content: string) => boolean;
})[];
export declare const EdgelessEditorActions: (ChatAction | {
    icon: TemplateResult<1>;
    title: string;
    showWhen: () => boolean;
    toast: string;
    handler: (host: EditorHost, content: string) => boolean;
})[];
export declare const ChatBlockPeekViewActions: {
    icon: TemplateResult<1>;
    title: string;
    showWhen: (host: EditorHost) => boolean;
    toast: string;
    handler: (host: EditorHost, content: string) => Promise<boolean>;
}[];
export {};
//# sourceMappingURL=chat-actions-handle.d.ts.map