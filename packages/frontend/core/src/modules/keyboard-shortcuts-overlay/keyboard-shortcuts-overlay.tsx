import { Modal } from '@affine/component';
import { useCallback } from 'react';

import { Shortcuts } from '../../desktop/dialogs/setting/general-setting/shortcuts';
import { useShortcutOverlayTrigger } from './use-shortcut-overlay-trigger';

/**
 * Global cheat-sheet overlay. Shows the existing Settings → Keyboard shortcuts
 * panel inside a modal whenever the user presses `?` outside an input.
 *
 * Closes on Escape or click-outside (Radix Modal defaults).
 */
export function KeyboardShortcutsOverlay() {
  const { open, setOpen } = useShortcutOverlayTrigger();

  const handleOpenChange = useCallback(
    (next: boolean) => {
      setOpen(next);
    },
    [setOpen]
  );

  return (
    <Modal open={open} onOpenChange={handleOpenChange} width={600}>
      <div data-testid="keyboard-shortcuts-overlay">
        <Shortcuts />
      </div>
    </Modal>
  );
}
