import { notify } from '@affine/component';
import type { ReactNode } from 'react';

const DEFAULT_DURATION_MS = 5000;

export interface NotifyWithUndoOptions {
  /**
   * Primary message displayed in the toast (e.g. "Provider disconnected").
   */
  message: ReactNode;
  /**
   * Optional title; if omitted, `message` is used as the title slot so the
   * action sits next to the primary line.
   */
  title?: ReactNode;
  /**
   * Inverse handler invoked when the user clicks "Undo". The toast dismisses
   * itself automatically after this returns.
   */
  onUndo: () => void | Promise<void>;
  /**
   * Auto-dismiss delay in ms. Defaults to 5000.
   */
  durationMs?: number;
  /**
   * Optional label for the undo button. Defaults to "Undo".
   */
  undoLabel?: ReactNode;
}

/**
 * Standardized "destructive op completed — Undo for Ns" toast.
 *
 * Wraps `@affine/component`'s `notify` with a pre-baked Undo action and a
 * 5s default auto-dismiss. The destructive action itself should be performed
 * BEFORE calling this helper (optimistic UX); this function only displays
 * confirmation + the inverse hook.
 *
 * Returns the toast id so callers may dismiss it programmatically (e.g. when
 * they re-do the action through other UI before the timer fires).
 */
export function notifyWithUndo({
  message,
  title,
  onUndo,
  durationMs = DEFAULT_DURATION_MS,
  undoLabel = 'Undo',
}: NotifyWithUndoOptions) {
  return notify(
    {
      title: title ?? message,
      message: title ? message : undefined,
      actions: [
        {
          key: 'undo',
          label: undoLabel,
          onClick: () => {
            // Run the inverse. notify auto-closes the toast after this call
            // because we leave `autoClose` at its default (true).
            Promise.resolve(onUndo()).catch(console.error);
          },
        },
      ],
    },
    { duration: durationMs }
  );
}
