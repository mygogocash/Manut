import { Modal } from '@affine/component';
import { useCallback, useMemo, useState } from 'react';

import * as styles from './shortcuts-overlay.css';
import { useGlobalShortcuts } from './use-global-shortcuts';

/**
 * Power-user shortcuts overlay (M2 E2.8 §B11).
 *
 * Cmd+/ (Ctrl+/ on non-Mac) opens a modal listing every global
 * shortcut the workspace shell exposes, grouped by category. This is
 * the discoverable surface — the existing `?` cheat-sheet at
 * `modules/keyboard-shortcuts-overlay/` still shows the full Settings
 * → Keyboard shortcuts panel (markdown + edgeless + page); THIS overlay
 * shows only the workspace-shell-level power-user bindings.
 *
 * Conflict note: the existing `affine:toggle-left-sidebar` command
 * already owns `Mod+/` (see `commands/affine-layout.tsx`). We bind to
 * `Mod+Shift+/` here (which on most keyboards reads as `Mod+?`) so we
 * don't fight the sidebar toggle. The two surfaces are now:
 *   - `?` (no modifier) → existing cheat-sheet (full shortcut panel)
 *   - `Mod+Shift+/`     → THIS overlay (workspace power-user shortcuts)
 *   - `Mod+/`           → sidebar toggle (unchanged)
 *
 * The non-Mac binding for the cheat-sheet hint comes through as
 * `Ctrl+?` on labels for symmetry with macOS `⌘?`.
 */

type ShortcutGroupKey = 'ai' | 'nav' | 'edit' | 'view';

interface ShortcutEntry {
  group: ShortcutGroupKey;
  /** Human label, e.g. "Open floating chat". */
  label: string;
  /**
   * Mac vs non-Mac key segments. Each segment renders as a separate
   * key cap. Use the literal modifier glyph for Mac and a word for
   * other platforms.
   */
  keys: { mac: readonly string[]; other: readonly string[] };
  /** Highlight as the new/featured binding in the violet accent. */
  featured?: boolean;
}

const SHORTCUTS: readonly ShortcutEntry[] = [
  {
    group: 'ai',
    label: 'Open floating AI chat',
    keys: { mac: ['⌘', 'J'], other: ['Ctrl', 'J'] },
  },
  {
    group: 'ai',
    label: 'Inline AI mini-chat at cursor',
    keys: { mac: ['⌘', '.'], other: ['Ctrl', '.'] },
    featured: true,
  },
  {
    group: 'nav',
    label: 'Quick switcher (recent docs)',
    keys: { mac: ['⌘', 'P'], other: ['Ctrl', 'P'] },
    featured: true,
  },
  {
    group: 'nav',
    label: 'Command palette',
    keys: { mac: ['⌘', 'K'], other: ['Ctrl', 'K'] },
  },
  {
    group: 'edit',
    label: 'New doc',
    keys: { mac: ['⌘', 'N'], other: ['Ctrl', 'N'] },
  },
  {
    group: 'edit',
    label: 'Open quick search',
    keys: { mac: ['⌘', 'O'], other: ['Ctrl', 'O'] },
  },
  {
    group: 'view',
    label: 'Settings',
    keys: { mac: ['⌘', ','], other: ['Ctrl', ','] },
  },
  {
    group: 'view',
    label: 'Toggle left sidebar',
    keys: { mac: ['⌘', '/'], other: ['Ctrl', '/'] },
  },
  {
    group: 'view',
    label: 'Toggle dark mode',
    keys: { mac: ['⌘', '\\'], other: ['Ctrl', '\\'] },
    featured: true,
  },
];

const GROUP_LABELS: Record<ShortcutGroupKey, string> = {
  ai: 'AI',
  nav: 'Navigation',
  edit: 'Edit',
  view: 'View',
};

export interface ShortcutsOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Pure presentational overlay. Caller owns open state — either via
 * `useShortcutsOverlay` (drives Cmd+Shift+/) or by mounting through
 * the workspace dialog system.
 */
export function ShortcutsOverlay({
  open,
  onOpenChange,
}: ShortcutsOverlayProps) {
  const isMac = environment.isMacOs;

  const grouped = useMemo(() => {
    const out: Record<ShortcutGroupKey, ShortcutEntry[]> = {
      ai: [],
      nav: [],
      edit: [],
      view: [],
    };
    for (const entry of SHORTCUTS) {
      out[entry.group].push(entry);
    }
    return out;
  }, []);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      onOpenChange(next);
    },
    [onOpenChange]
  );

  return (
    <Modal open={open} onOpenChange={handleOpenChange} width={680}>
      <div className={styles.overlayRoot} data-testid="shortcuts-overlay">
        <header className={styles.overlayHeader}>
          <h2 className={styles.overlayTitle}>Keyboard shortcuts</h2>
          <p className={styles.overlaySubtitle}>
            Power-user bindings available across the workspace shell. Type
            inside a doc to bypass — none of these hijack the editor.
          </p>
        </header>
        <div className={styles.groupGrid}>
          {(Object.keys(grouped) as ShortcutGroupKey[]).map(groupKey => (
            <section
              key={groupKey}
              className={styles.groupCard}
              data-testid={`shortcut-group-${groupKey}`}
            >
              <h3 className={styles.groupHeading}>{GROUP_LABELS[groupKey]}</h3>
              {grouped[groupKey].map(entry => (
                <div key={entry.label} className={styles.shortcutRow}>
                  <span className={styles.shortcutLabel}>{entry.label}</span>
                  <span className={styles.shortcutKeys}>
                    {(isMac ? entry.keys.mac : entry.keys.other).map(
                      (k, idx) => (
                        <kbd
                          key={`${entry.label}-${k}-${idx}`}
                          className={
                            entry.featured
                              ? `${styles.shortcutKey} ${styles.shortcutKeyActive}`
                              : styles.shortcutKey
                          }
                        >
                          {k}
                        </kbd>
                      )
                    )}
                  </span>
                </div>
              ))}
            </section>
          ))}
        </div>
        <div className={styles.overlayHint}>
          Press <kbd className={styles.shortcutKey}>?</kbd> for the full editor
          cheat-sheet (markdown, edgeless, page).
        </div>
      </div>
    </Modal>
  );
}

/**
 * Hook that opens the shortcuts overlay on Cmd+Shift+/ (a.k.a. Cmd+?).
 *
 * Mounted alongside `ShortcutsOverlay` in the workspace layout.
 */
export function useShortcutsOverlay(): {
  open: boolean;
  setOpen: (open: boolean) => void;
} {
  const [open, setOpen] = useState(false);

  const bindings = useMemo(
    () => ({
      'Mod+Shift+/': (event: KeyboardEvent) => {
        event.preventDefault();
        setOpen(prev => !prev);
      },
      // Allow Escape to close — independent of the global guard so we
      // can dismiss with focus inside any cap focus trap.
      Escape: () => {
        setOpen(prev => (prev ? false : prev));
      },
    }),
    []
  );

  useGlobalShortcuts(bindings, { ignoreEditableGuard: false });

  return { open, setOpen };
}
