import type { CopilotChatHistoryFragment } from '@affine/graphql';
import type { EditorHost } from '@blocksuite/affine/std';
import type { NotificationService } from '@blocksuite/affine-shared/services';
import { LitElement, nothing } from 'lit';
import type { ChatAction } from '../_common/chat-actions-handle';
export declare class ChatActionList extends LitElement {
    static styles: import("lit").CSSResult;
    private get _selectionValue();
    private get _currentTextSelection();
    private get _currentBlockSelections();
    private get _currentImageSelections();
    accessor host: EditorHost;
    accessor actions: ChatAction[];
    accessor content: string;
    accessor session: CopilotChatHistoryFragment | null | undefined;
    accessor messageId: string | undefined;
    accessor layoutDirection: 'horizontal' | 'vertical';
    accessor withMargin: boolean;
    accessor testId: string;
    accessor notificationService: NotificationService;
    render(): import("lit-html").TemplateResult<1> | typeof nothing;
}
declare global {
    interface HTMLElementTagNameMap {
        'chat-action-list': ChatActionList;
    }
}
//# sourceMappingURL=chat-action-list.d.ts.map