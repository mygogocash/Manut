import { QuickSwitcher, useQuickSwitcher } from './quick-switcher';
import { ShortcutsOverlay, useShortcutsOverlay } from './shortcuts-overlay';

/**
 * Single mount-point for the M2 E2.8 keyboard-driven surfaces.
 *
 * - Cmd+P  → Quick switcher (recent docs + preview)
 * - Cmd+Shift+/ → Shortcuts overlay (workspace cheat-sheet)
 *
 * Co-mounted here so the workspace layout only needs one
 * `<KeyboardShortcutsAnchor />` import. The two surfaces share the
 * `useGlobalShortcuts` hook under the hood, which guarantees no
 * cross-binding conflicts (first-match-wins within a single hook
 * instance; across instances, modifier specificity diverges enough
 * that ⌘P and ⌘? never overlap).
 */
export function KeyboardShortcutsAnchor() {
  const switcher = useQuickSwitcher();
  const overlay = useShortcutsOverlay();

  return (
    <>
      <QuickSwitcher open={switcher.open} onOpenChange={switcher.setOpen} />
      <ShortcutsOverlay open={overlay.open} onOpenChange={overlay.setOpen} />
    </>
  );
}
