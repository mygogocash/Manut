import { type EditorHost } from '@blocksuite/affine/std';
export declare const AI_INLINE_CHAT_TAG = "ai-inline-chat";
declare const AIInlineChat_base: any;
export declare class AIInlineChat extends AIInlineChat_base {
    static styles: import("lit").CSSResult;
    accessor host: EditorHost;
    /**
     * Snapshot of the cursor selection at open time. We don't track
     * it live — the cursor may move while the panel is open and we
     * specifically want to anchor to where the user invoked.
     */
    accessor selection: Range | null;
    /**
     * The currently-selected text, if any. Wrapped in the prompt as
     * a quoted block so the AI can reason over the selection.
     */
    accessor selectedText: string;
    /**
     * Anchor rect in viewport coordinates. Used to position the card
     * just below the cursor without re-querying the (possibly
     * moving) selection.
     */
    accessor anchorRect: DOMRect | null;
    accessor onCloseRequested: (() => void) | undefined;
    private accessor _uiState;
    private accessor _previewText;
    private accessor _hasContent;
    private accessor _errorMessage;
    private accessor _textarea;
    private _abortController;
    connectedCallback(): void;
    disconnectedCallback(): void;
    updated(changed: Map<PropertyKey, unknown>): void;
    private _applyAnchorPosition;
    private readonly _onHostKeyDown;
    private readonly _onInput;
    private readonly _submit;
    private readonly _stop;
    private readonly _accept;
    private _resolveAnchorBlock;
    private readonly _reject;
    private readonly _retry;
    private _close;
    private _renderQuote;
    private _renderInput;
    private _renderGenerating;
    private _renderAnswer;
    private _renderError;
    render(): import("lit-html").TemplateResult<1>;
}
declare global {
    interface HTMLElementTagNameMap {
        'ai-inline-chat': AIInlineChat;
    }
}
export {};
//# sourceMappingURL=inline-chat.d.ts.map