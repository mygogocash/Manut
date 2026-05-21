import { LifeCycleWatcher } from '@blocksuite/affine/std';
/**
 * Mounts <ai-inline-chat> on Cmd+. / Ctrl+. inside a page editor.
 *
 * The keymap binding is global within the editor's event dispatcher
 * (flavour: undefined) so the shortcut fires from any block, not
 * just one specific flavour.
 */
export declare class AIInlineChatWatcher extends LifeCycleWatcher {
    static key: string;
    private _currentElement;
    mounted(): void;
    unmounted(): void;
    private _dispose;
    private _openInlineChat;
    /**
     * Returns the markdown for the current text selection — or empty
     * string if the cursor is collapsed. We use plain textContent
     * here because the inline chat preview keeps things lightweight;
     * the markdown adapter pattern (CLAUDE.md §6c) is only needed
     * when the AI must reason over rich formatting, which Cmd+. flows
     * generally do not.
     */
    private _extractSelectedText;
}
//# sourceMappingURL=extension.d.ts.map