/**
 * Lazy Web Audio API wrapper for the M2 E2.8 audio cues feature.
 *
 * Five short cues are exposed:
 *   - `message-sent`        — short up-chirp; fires on user-sent chat
 *                              message acknowledgement.
 *   - `ai-complete`         — two-tone confirmation; fires when an AI
 *                              tool call finishes successfully.
 *   - `connection-success`  — single high-pitch ping; fires on cloud
 *                              connect / sync resume.
 *   - `error`               — descending two-tone; fires on chat error
 *                              or AI tool failure.
 *   - `notification`        — soft single-tone; fires on inbox /
 *                              comment notifications.
 *
 * Cues are generated via `AudioContext.createOscillator` (sine waves,
 * ~80ms each). NO audio files ship — eliminates licensing concerns,
 * the bundle delta is zero, and the cue palette is consistent across
 * platforms.
 *
 * Browser constraints:
 *   - `AudioContext` construction is blocked until a user gesture in
 *     Chrome/Safari. We lazy-construct on first `playCue()` call,
 *     after the user has interacted with the page. The toggle that
 *     turns cues on must therefore be activated INSIDE the settings
 *     panel (user click), satisfying this constraint trivially.
 *   - Reduced-motion preferences do NOT affect audio — the audio
 *     toggle is its own decision, defaults off (see Settings panel
 *     wiring in appearance/index.tsx).
 */

export type CueName =
  | 'message-sent'
  | 'ai-complete'
  | 'connection-success'
  | 'error'
  | 'notification';

interface ToneSegment {
  frequency: number;
  duration: number; // seconds
  delay: number; // seconds from cue start
  type?: OscillatorType;
  /** Peak gain. Default 0.08 — keep cues quiet enough to live with. */
  gain?: number;
}

const DEFAULT_GAIN = 0.08;

const CUES: Record<CueName, readonly ToneSegment[]> = {
  // 880Hz → 1320Hz brief chirp, ~80ms
  'message-sent': [
    { frequency: 880, duration: 0.04, delay: 0 },
    { frequency: 1320, duration: 0.04, delay: 0.04 },
  ],
  // Major-third two-tone: A5 + C#6, each 60ms
  'ai-complete': [
    { frequency: 880, duration: 0.06, delay: 0 },
    { frequency: 1108.73, duration: 0.06, delay: 0.06 },
  ],
  // Single high ping at 1568Hz (G6), 80ms
  'connection-success': [{ frequency: 1568, duration: 0.08, delay: 0 }],
  // Descending E5 → C5, 60ms each. Triangle wave for slightly more
  // "thud" character than a pure sine.
  error: [
    { frequency: 659.25, duration: 0.06, delay: 0, type: 'triangle' },
    { frequency: 523.25, duration: 0.06, delay: 0.06, type: 'triangle' },
  ],
  // Soft single 660Hz ping, 100ms, lower volume
  notification: [{ frequency: 660, duration: 0.1, delay: 0, gain: 0.06 }],
};

let audioCtx: AudioContext | null = null;
let warmed = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (audioCtx) return audioCtx;
  // `AudioContext` typing is available globally in lib.dom.d.ts.
  // Some older browsers expose `webkitAudioContext` — TypeScript
  // doesn't model that, so we fall through to a window-cast.
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  try {
    audioCtx = new Ctor();
    return audioCtx;
  } catch {
    return null;
  }
}

/**
 * Play a named audio cue. No-op if the browser blocks audio context
 * creation, the cue name is unknown, or the context is in a
 * suspended state we can't resume.
 *
 * NEVER awaits anything past the audio context init — cue playback
 * runs synchronously after a single async resume, so callers can
 * fire-and-forget from a render-path effect or chat tool handler.
 */
export async function playCue(name: CueName): Promise<void> {
  const segments = CUES[name];
  if (!segments) return;

  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
  } catch {
    return;
  }

  const startTime = ctx.currentTime + 0.005;

  for (const segment of segments) {
    const segStart = startTime + segment.delay;
    const segEnd = segStart + segment.duration;
    const gain = segment.gain ?? DEFAULT_GAIN;

    const osc = ctx.createOscillator();
    osc.type = segment.type ?? 'sine';
    osc.frequency.setValueAtTime(segment.frequency, segStart);

    const gainNode = ctx.createGain();
    // Quick attack / release envelope so cues don't click at the
    // segment boundaries. 8ms in/out — short enough to feel snappy.
    gainNode.gain.setValueAtTime(0, segStart);
    gainNode.gain.linearRampToValueAtTime(gain, segStart + 0.008);
    gainNode.gain.setValueAtTime(gain, segEnd - 0.012);
    gainNode.gain.linearRampToValueAtTime(0, segEnd);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    osc.start(segStart);
    osc.stop(segEnd + 0.02);
  }
  warmed = true;
}

/**
 * Best-effort warm-up: if the audio context can be constructed but
 * is suspended, fire a 0-gain blip to nudge it into `running` after
 * the user has interacted with the page. Safe to call repeatedly.
 *
 * Most useful when the user has just toggled the audio setting ON
 * and we want the FIRST cue (e.g. a chat send) to play without the
 * usual "context.resume() then dropped first sample" jitter.
 */
export async function warmAudioContext(): Promise<void> {
  if (warmed) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    const t = ctx.currentTime + 0.005;
    osc.start(t);
    osc.stop(t + 0.01);
    warmed = true;
  } catch {
    // ignore
  }
}

/** Cue names exported for typing in consumers. */
export const ALL_CUE_NAMES: readonly CueName[] = [
  'message-sent',
  'ai-complete',
  'connection-success',
  'error',
  'notification',
];
