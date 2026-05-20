import { useEffect } from 'react';

/**
 * Global keyboard binding for the FloatingAiChatAnchor. Cmd+J (macOS) or
 * Ctrl+J (everywhere else) toggles the panel. Esc closes when open.
 *
 * Modelled on `useShortcutOverlayTrigger` (modules/keyboard-shortcuts-overlay)
 * — same edit-target guard so we don't hijack ⌘J when the user is typing
 * inside an input, textarea, contenteditable, or BlockSuite editor.
 *
 * The handler reads + writes the panel state via callbacks rather than
 * subscribing to a LiveData directly, so the hook can compose with any
 * state store the parent picks (React useState, LiveData, signals — all
 * fine).
 */
export interface UseFloatingChatShortcutOptions {
  enabled: boolean;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
    return true;
  }
  if (target.isContentEditable) return true;
  // BlockSuite / ProseMirror editors set role="textbox" on their roots.
  if (target.getAttribute('role') === 'textbox') return true;
  return false;
}

export function useFloatingChatShortcut({
  enabled,
  isOpen,
  onToggle,
  onClose,
}: UseFloatingChatShortcutOptions): void {
  useEffect(() => {
    if (!enabled) return;

    const handler = (event: KeyboardEvent) => {
      // Esc closes when the panel is open. Allowed from any target so the
      // user can close even with focus inside the chat input.
      if (event.key === 'Escape' && isOpen) {
        event.preventDefault();
        onClose();
        return;
      }

      // ⌘J / Ctrl+J toggles. Match `key.toLowerCase()` so the binding survives
      // capslock and layout-specific quirks.
      //
      // M2 E2.6: ⌘. (Cmd+Period) is a SEPARATE shortcut owned by the
      // in-editor inline AI chat (see ../../blocksuite/ai/inline-chat).
      // It is registered through BlockSuite's UIEventDispatcher, which
      // only dispatches while an editor host is focused — exactly the
      // inverse of the editable-target guard below — so there is no
      // collision with this hook. Do NOT add Period handling here.
      const isMod = event.metaKey || event.ctrlKey;
      if (!isMod) return;
      if (event.key.toLowerCase() !== 'j') return;
      // Don't fire when the user is typing inside an editor — ⌘J should
      // toggle the panel from the workbench shell, not from inside a doc.
      // Note: when the chat input itself is focused this guard also fires,
      // but that's fine because the close-on-Esc above covers exit.
      if (isEditableTarget(event.target)) return;

      event.preventDefault();
      onToggle();
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [enabled, isOpen, onToggle, onClose]);
}
