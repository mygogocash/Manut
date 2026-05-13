/**
 * Per-doc recent-activity ring buffer.
 *
 * The Knowledge Graph node detail panel surfaces "Recent AI activity" — every
 * time an agent reads/edits a doc we want a short rolling window of events
 * scoped to that doc. We keep our own buffer rather than reaching into an
 * external bus so the panel can render an empty state today and be wired up
 * trivially when the activation-bus contract lands.
 *
 * Design notes:
 *
 *  - Pure data structure (no React, no rxjs) so it's trivially testable.
 *  - Single-array ring with a write head — O(1) push, O(capacity) recent().
 *  - Window-based pruning at read-time (not push-time) so a sleepy session
 *    with no `recent()` calls doesn't burn CPU on housekeeping.
 *  - `now` injected into `recent()` so tests can use a deterministic clock.
 *  - The `data` field is `unknown` per CLAUDE.md — callers narrow when they
 *    actually render it.
 */

export interface ActivityEvent {
  /** Doc id the event is scoped to. */
  docId: string;
  /** Epoch ms when the event happened. */
  timestamp: number;
  /** Name of the tool / action that fired. */
  toolName: string;
  /** Optional agent label (e.g. "Auto Tag", "Doc Writer"). */
  agentLabel?: string;
  /** Free-form payload; callers must narrow before rendering. */
  data?: unknown;
}

export interface ActivityBuffer {
  /** Append an event. Wraps when capacity is reached. */
  push(event: ActivityEvent): void;
  /**
   * Return the events for `docId` whose timestamp is within `windowMs` of
   * `now`. Sorted newest-first. Returns a defensive copy so callers can't
   * mutate the buffer.
   */
  recent(docId: string, now: number): ActivityEvent[];
  /** Number of events currently retained (for tests + debugging). */
  size(): number;
  /** Drop everything. */
  clear(): void;
}

export interface ActivityBufferOptions {
  /** How long an event remains "recent". Defaults to 60s. */
  windowMs?: number;
  /** Total events retained across all docs. Defaults to 200. */
  capacity?: number;
}

export const DEFAULT_WINDOW_MS = 60_000;
export const DEFAULT_CAPACITY = 200;

export function createActivityBuffer(
  options: ActivityBufferOptions = {}
): ActivityBuffer {
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const capacity = Math.max(1, options.capacity ?? DEFAULT_CAPACITY);

  // Fixed-size ring. `null` = empty slot.
  const ring: Array<ActivityEvent | null> = Array.from(
    { length: capacity },
    () => null
  );
  let head = 0;
  let count = 0;

  return {
    push(event) {
      ring[head] = event;
      head = (head + 1) % capacity;
      if (count < capacity) count++;
    },
    recent(docId, now) {
      const cutoff = now - windowMs;
      const out: ActivityEvent[] = [];
      // Walk the ring backwards from head-1 (most recent) so output ordering
      // is naturally newest-first without a sort pass.
      for (let i = 0; i < count; i++) {
        const idx = (head - 1 - i + capacity) % capacity;
        const ev = ring[idx];
        if (!ev) continue;
        if (ev.docId !== docId) continue;
        if (ev.timestamp < cutoff) continue;
        out.push(ev);
      }
      return out;
    },
    size() {
      return count;
    },
    clear() {
      for (let i = 0; i < capacity; i++) ring[i] = null;
      head = 0;
      count = 0;
    },
  };
}
