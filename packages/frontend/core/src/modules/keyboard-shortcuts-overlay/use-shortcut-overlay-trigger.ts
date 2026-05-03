import { useEffect, useState } from 'react';

/**
 * Returns true when the cheat-sheet overlay should be visible. Listens
 * globally for `?` (Shift+/) and toggles open. Ignores keystrokes that
 * originate from text inputs, textareas, or contenteditable nodes so we
 * don't hijack typing.
 */
export function useShortcutOverlayTrigger(): {
  open: boolean;
  setOpen: (open: boolean) => void;
} {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null): boolean => {
      if (!target || !(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        return true;
      }
      if (target.isContentEditable) return true;
      // BlockSuite / ProseMirror editors set role="textbox" on their roots.
      if (target.getAttribute('role') === 'textbox') return true;
      return false;
    };

    const handler = (event: KeyboardEvent) => {
      // Ignore when modifier keys are held — those are real shortcuts.
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      // `?` is Shift+/ on US layouts. Match by `key` so layout-independent.
      if (event.key !== '?') return;
      if (isEditableTarget(event.target)) return;
      // Don't fire while another modal/dialog likely owns focus — Radix
      // dialogs trap focus inside themselves, so the target check above
      // handles inputs inside dialogs but not raw key handlers. Keep this
      // permissive: if a modal is open, the user can still open the
      // shortcut overlay, but we close on Escape so it stays sane.
      event.preventDefault();
      setOpen(prev => !prev);
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return { open, setOpen };
}
