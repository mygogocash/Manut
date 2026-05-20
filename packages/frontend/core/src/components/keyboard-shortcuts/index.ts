/**
 * M2 E2.8 power-user shortcuts surface.
 *
 * The mount-point is `workspace-layout.tsx` — a single
 * `<KeyboardShortcutsAnchor />` mounts BOTH the quick switcher
 * (Cmd+P) and the shortcuts overlay (Cmd+Shift+/). Co-mounting them
 * here keeps the workbench shell's set of global key handlers
 * concentrated in one place — easier to audit for binding conflicts.
 *
 * The existing `?` cheat-sheet (`modules/keyboard-shortcuts-overlay/`)
 * stays mounted separately because it has a different conceptual
 * audience: full editor cheat-sheet (markdown, edgeless, page) vs
 * the workspace-shell power-user palette this module surfaces.
 */
export { KeyboardShortcutsAnchor } from './anchor';
export { QuickSwitcher, useQuickSwitcher } from './quick-switcher';
export { ShortcutsOverlay, useShortcutsOverlay } from './shortcuts-overlay';
export {
  type GlobalShortcutHandler,
  type GlobalShortcutMap,
  useGlobalShortcuts,
} from './use-global-shortcuts';
