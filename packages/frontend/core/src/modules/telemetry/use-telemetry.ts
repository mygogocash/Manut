import { useCallback } from 'react';

import type { TelemetryEvents } from './events';
import { trackEvent } from './events';

/**
 * React-side accessor for the typed `trackEvent` API. Returns a stable
 * callback so consumers can use it in `useCallback` deps without
 * triggering re-renders. The underlying `trackEvent` is itself
 * referentially stable (it's a module-level function) but wrapping it
 * via `useCallback` keeps the surface ergonomic and gives us a hook
 * to attach future context (workspace id, user id, etc.) without
 * touching every call site.
 *
 * Usage:
 *   const track = useTelemetry();
 *   track('floating_chat_opened', { from: 'shortcut' });
 */
export function useTelemetry() {
  return useCallback(
    <K extends keyof TelemetryEvents>(event: K, props: TelemetryEvents[K]) => {
      trackEvent(event, props);
    },
    []
  );
}
