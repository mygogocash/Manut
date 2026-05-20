// Manut M2 E2.6 — inline AI mini-chat keymap registration.
//
// Hooks into the BlockSuite page-editor lifecycle and binds
// Cmd+Period / Ctrl+Period to open the floating inline-chat
// element. Modelled on AIPageRootWatcher (extensions/ai-page-root.ts)
// — same LifeCycleWatcher pattern, mounted once per editor instance,
// disposables cleaned up when the editor tears down.
//
// Why a LifeCycleWatcher and not a global hook?
// 1. The keymap dispatcher (host.event.bindHotkey) is scoped to a
//    living EditorHost. Binding inside the watcher means the
//    shortcut only fires when an editor is mounted AND focused.
//    No need to roll our own "is the editor focused?" detection.
// 2. The existing useFloatingChatShortcut (Cmd+J) in
//    components/floating-ai-chat-anchor explicitly guards against
//    firing inside editable targets. Cmd+. lives on the other side
//    of that fence — it should ONLY fire inside the editor. The
//    BlockSuite dispatcher already enforces that for us.
// 3. Disposal is automatic via this.disposables — no leaks when
//    docs navigate.

import { LifeCycleWatcher, TextSelection } from '@blocksuite/affine/std';

import { AI_INLINE_CHAT_TAG, type AIInlineChat } from './inline-chat';

/**
 * Mounts <ai-inline-chat> on Cmd+. / Ctrl+. inside a page editor.
 *
 * The keymap binding is global within the editor's event dispatcher
 * (flavour: undefined) so the shortcut fires from any block, not
 * just one specific flavour.
 */
export class AIInlineChatWatcher extends LifeCycleWatcher {
  static override key = 'ai-inline-chat-watcher';

  private _currentElement: AIInlineChat | null = null;

  override mounted() {
    super.mounted();
    const event = this.std.event;
    if (!event) return;

    this.disposables.add(
      event.bindHotkey(
        {
          // BlockSuite's keymap dialect: 'Mod' resolves to ⌘ on
          // macOS / Ctrl elsewhere. The period key is the literal
          // '.', no shift transform involved.
          'Mod-.': ctx => {
            const keyboardState = ctx.get('keyboardState');
            const event = keyboardState.raw;
            event.preventDefault();
            event.stopPropagation();
            this._openInlineChat();
            return true;
          },
        },
        { global: true }
      )
    );
  }

  override unmounted() {
    super.unmounted();
    this._dispose();
  }

  private _dispose() {
    if (this._currentElement) {
      this._currentElement.remove();
      this._currentElement = null;
    }
  }

  private _openInlineChat() {
    // Don't stack multiple instances if the user mashes the shortcut.
    if (this._currentElement?.isConnected) {
      this._currentElement.focus();
      return;
    }

    const host = this.std.host;
    if (!host) return;

    // Capture the cursor anchor before mounting. We use the native
    // selection range so we anchor on the literal caret rect (even
    // mid-line), not the entire block's bounding box.
    const nativeSelection = window.getSelection();
    let anchorRect: DOMRect | null = null;
    let savedRange: Range | null = null;

    if (
      nativeSelection &&
      nativeSelection.rangeCount > 0 &&
      host.contains(nativeSelection.anchorNode as Node | null)
    ) {
      savedRange = nativeSelection.getRangeAt(0).cloneRange();
      const rects = savedRange.getClientRects();
      anchorRect =
        rects.length > 0
          ? rects[rects.length - 1]
          : savedRange.getBoundingClientRect();
    }

    // Fallback: anchor on the focused BlockSuite block.
    if (!anchorRect || (anchorRect.width === 0 && anchorRect.height === 0)) {
      const textSelection = host.selection.find(TextSelection);
      if (textSelection) {
        const block = host.view.getBlock(textSelection.blockId);
        if (block) {
          anchorRect = block.getBoundingClientRect();
        }
      }
    }

    if (!anchorRect) {
      // No usable selection — bail. The shortcut is a no-op rather
      // than mounting in a confusing place.
      return;
    }

    const selectedText = this._extractSelectedText();

    const element = document.createElement(AI_INLINE_CHAT_TAG) as AIInlineChat;
    element.host = host;
    element.selection = savedRange;
    element.selectedText = selectedText;
    element.anchorRect = anchorRect;
    element.onCloseRequested = () => {
      this._currentElement = null;
    };

    // Mount at the document body level so the floating card escapes
    // any z-index / overflow:hidden ancestors in the editor surface.
    document.body.append(element);
    this._currentElement = element;
  }

  /**
   * Returns the markdown for the current text selection — or empty
   * string if the cursor is collapsed. We use plain textContent
   * here because the inline chat preview keeps things lightweight;
   * the markdown adapter pattern (CLAUDE.md §6c) is only needed
   * when the AI must reason over rich formatting, which Cmd+. flows
   * generally do not.
   */
  private _extractSelectedText(): string {
    const textSelection = this.std.host?.selection.find(TextSelection);
    if (!textSelection || textSelection.isCollapsed()) return '';
    const sel = window.getSelection();
    return sel?.toString() ?? '';
  }
}
