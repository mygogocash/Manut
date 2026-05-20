import { useEffect, useRef } from 'react';

/**
 * Central global-shortcut registry hook for M2 E2.8.
 *
 * Mirrors the input-focus guard from
 * `components/floating-ai-chat-anchor/use-floating-chat-shortcut.ts` —
 * we never want a Cmd-shortcut to hijack typing inside an input,
 * textarea, contenteditable, or BlockSuite editor.
 *
 * Bindings are passed as an object keyed by a tinykeys-style spec.
 * For now we only support `Mod+<key>` (Cmd on macOS, Ctrl elsewhere)
 * plus standalone `Escape` — that covers the power-user shortcut
 * surface for the M2 wave. Extending to chord sequences would
 * require pulling in tinykeys; keep it minimal until we need more.
 *
 * Re-runs on `bindings` identity changing without leaking listeners.
 * Callers should memoise the bindings object with `useMemo` so the
 * effect only re-subscribes when the handler set actually changes.
 */

export type GlobalShortcutHandler = (event: KeyboardEvent) => void;

export type GlobalShortcutMap = Record<string, GlobalShortcutHandler>;

export interface UseGlobalShortcutsOptions {
  /** Disable all bindings without unmounting. Default true. */
  enabled?: boolean;
  /**
   * Bypass the editable-target guard. Most consumers want the guard;
   * leave undefined unless you specifically need to fire while a
   * textarea is focused (e.g. an Escape close-on-blur).
   */
  ignoreEditableGuard?: boolean;
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

interface ParsedBinding {
  needsMod: boolean;
  needsShift: boolean;
  key: string;
}

/**
 * Parse a binding string like `Mod+k`, `Mod+Shift+P`, or `Escape`.
 * Layout-independent: matches on `event.key.toLowerCase()`.
 *
 * Returns null for malformed input — caller drops the binding.
 */
function parseBinding(spec: string): ParsedBinding | null {
  if (!spec) return null;
  const parts = spec.split('+').map(p => p.trim());
  let needsMod = false;
  let needsShift = false;
  let key = '';
  for (const part of parts) {
    const lower = part.toLowerCase();
    if (lower === 'mod' || lower === 'cmd' || lower === 'ctrl') {
      needsMod = true;
      continue;
    }
    if (lower === 'shift') {
      needsShift = true;
      continue;
    }
    key = lower;
  }
  if (!key) return null;
  return { needsMod, needsShift, key };
}

export function useGlobalShortcuts(
  bindings: GlobalShortcutMap,
  options: UseGlobalShortcutsOptions = {}
): void {
  const { enabled = true, ignoreEditableGuard = false } = options;
  // Stash bindings + options in a ref so we can re-read on every
  // keydown without re-subscribing. The effect below only re-binds
  // when the `bindings` identity changes (caller responsibility to
  // memoise) — we update the ref inline so the latest handler set
  // always wins.
  const bindingsRef = useRef(bindings);
  bindingsRef.current = bindings;
  const guardRef = useRef(ignoreEditableGuard);
  guardRef.current = ignoreEditableGuard;

  // Compute the dep key OUTSIDE the effect so the deps array doesn't
  // contain an expression. The sorted spec list is the only thing
  // that should trigger a re-subscribe — handler identities can
  // change every render without thrashing the global listener.
  const bindingsKey = Object.keys(bindings).sort().join('|');

  useEffect(() => {
    if (!enabled) return;

    const parsed = new Map<string, ParsedBinding>();
    for (const spec of Object.keys(bindingsRef.current)) {
      const p = parseBinding(spec);
      if (p) parsed.set(spec, p);
    }

    const handler = (event: KeyboardEvent) => {
      const isMod = event.metaKey || event.ctrlKey;
      // Standalone Escape needs to work even when an input is focused
      // (close-on-Esc UX). Modifier-bound shortcuts respect the guard.
      const eventKey = event.key.toLowerCase();

      for (const [spec, p] of parsed) {
        if (p.needsMod && !isMod) continue;
        if (!p.needsMod && (event.metaKey || event.ctrlKey || event.altKey)) {
          continue;
        }
        if (p.needsShift !== event.shiftKey) continue;
        if (p.key !== eventKey) continue;

        // Apply the input-focus guard for modifier-bound bindings
        // unless caller opts out. Standalone keys (no mod) ALWAYS
        // respect the guard so we don't hijack typing.
        if (!guardRef.current && isEditableTarget(event.target)) {
          continue;
        }

        const fn = bindingsRef.current[spec];
        if (fn) {
          fn(event);
          // First match wins. Prevents two bindings from firing on
          // the same keystroke if a caller accidentally overlaps.
          return;
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // Depend on the pre-computed bindingsKey so re-render with the
    // same KEY-SET (handlers changed but the set didn't) does NOT
    // re-subscribe.
  }, [enabled, bindingsKey]);
}
