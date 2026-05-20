import { GlobalStateService } from '@affine/core/modules/storage';
import { LiveData, useLiveData, useService } from '@toeverything/infra';
import { useCallback, useMemo } from 'react';

import { type CueName, playCue, warmAudioContext } from './audio-cues';

/**
 * React-side wrapper for the audio cue palette (M2 E2.8).
 *
 * Three responsibilities:
 *   1. Read the user's `audioCues.enabled` preference from
 *      GlobalState — default `false` per IMPLEMENTATION_PLAN.md
 *      decision #14 (off by default; opt-in only).
 *   2. Provide a `play(cueName)` callback that no-ops when disabled
 *      and lazy-creates the AudioContext on first enabled call.
 *   3. Expose `setEnabled(boolean)` so the Settings panel can write
 *      through the same hook.
 *
 * The hook is process-wide cheap to call from many components; the
 * underlying GlobalState subscription is shared. Components that
 * fire cues from effects should memoise the `play` callback or read
 * `enabled` first to avoid pulling AudioContext when off.
 */

const STORAGE_KEY = 'audioCues.enabled';

export interface UseAudioCuesResult {
  /**
   * Whether cue playback is currently enabled. `undefined` while the
   * GlobalState entry is still resolving on first paint — treat as
   * "off" for safety.
   */
  enabled: boolean;
  /** Play a named cue. No-op when disabled. */
  play: (cue: CueName) => void;
  /** Update the persisted preference. Warms the audio context on enable. */
  setEnabled: (next: boolean) => void;
}

export function useAudioCues(): UseAudioCuesResult {
  const globalStateService = useService(GlobalStateService);
  const globalState = globalStateService.globalState;

  const enabled$ = useMemo(
    () =>
      LiveData.from<boolean | undefined>(
        globalState.watch<boolean>(STORAGE_KEY),
        undefined
      ),
    [globalState]
  );

  const rawEnabled = useLiveData(enabled$);
  const enabled = rawEnabled === true;

  const play = useCallback(
    (cue: CueName) => {
      if (!enabled) return;
      // Fire-and-forget — playCue swallows errors internally. The
      // `.catch` is defensive against a future error path leaking
      // out of the helper; today it's unreachable.
      playCue(cue).catch(() => {
        /* swallow — audio cue failures are not user-actionable */
      });
    },
    [enabled]
  );

  const setEnabled = useCallback(
    (next: boolean) => {
      globalState.set(STORAGE_KEY, next);
      if (next) {
        // Best-effort warm so the user's NEXT cue plays without the
        // first-suspended-context jitter. Runs in user-gesture
        // context because this setter is called from a Switch click.
        warmAudioContext().catch(() => {
          /* swallow — warm-up failures are not user-actionable */
        });
      }
    },
    [globalState]
  );

  return { enabled, play, setEnabled };
}

/**
 * Stand-alone setter — for places that need to flip the preference
 * without subscribing to the value (e.g. a settings reset action).
 */
export function setAudioCuesEnabled(
  globalStateService: GlobalStateService,
  next: boolean
): void {
  globalStateService.globalState.set(STORAGE_KEY, next);
  if (next) {
    warmAudioContext().catch(() => {
      /* swallow */
    });
  }
}

/**
 * Stand-alone reader — useful in non-React code paths.
 */
export function readAudioCuesEnabled(
  globalStateService: GlobalStateService
): boolean {
  return globalStateService.globalState.get<boolean>(STORAGE_KEY) === true;
}
