import { Subject } from 'rxjs';

/**
 * A single "the AI just touched this doc" event. Whether the AI is on the
 * frontend (chat panel tool dispatch) or the backend (any copilot tool), the
 * same event shape is used. The graph view subscribes to one stream of these
 * and animates a synaptic pulse from the corresponding node along its
 * outgoing edges.
 */
export interface DocReadActivation {
  /** Doc whose node should pulse. */
  docId: string;
  /** Workspace the doc lives in. Used to filter SSE on the subscribing side. */
  workspaceId: string;
  /**
   * Deduplication key. The frontend emits optimistically the moment the user
   * sends a chat tool call (no round-trip); the backend emits the same event
   * once it finishes processing the tool. If `sourceId` matches between the
   * two within a short window we drop the duplicate so a single read doesn't
   * pulse twice.
   *
   * Generate fresh per emit if you don't have a request id — `crypto.randomUUID()`
   * is fine. Just make it unique per logical read event.
   */
  sourceId: string;
  /**
   * Which tool was invoked. `'frontend-local'` is the special value emitted
   * by the chat panel before the backend sees the request; useful for
   * telemetry and for the graph view's instant-feedback path.
   */
  op:
    | 'searchWorkspace'
    | 'docRead'
    | 'readingDocs'
    | 'docEdit'
    | 'sectionEdit'
    | 'frontend-local'
    | 'other';
  /** Optional session / cron job / agent id. Surfaced in tooltips later. */
  agentId?: string;
  /** Epoch ms when the event was created. */
  ts: number;
}

/**
 * Window during which two events with the same `sourceId` collapse into one.
 * Frontend pre-emit + backend post-emit typically arrive within
 * <500ms; 2s leaves slack for slow backends without letting genuine repeat
 * reads (same sourceId by accident) merge silently.
 */
const DEDUPE_WINDOW_MS = 2000;

/**
 * Maximum number of recent sourceIds to remember for dedup. Bounded so a
 * busy workspace can't grow this map without limit.
 */
const DEDUPE_LRU_CAP = 512;

/**
 * Workspace-scoped activation bus. The graph view subscribes to one instance
 * via `useActivationBus()` (provided in `index.ts`). Producers (chat panel,
 * SSE subscriber) call `emit()`. Duplicates within `DEDUPE_WINDOW_MS` are
 * silently dropped.
 *
 * Intentionally NOT an `Entity` from `@toeverything/infra` — the surface is
 * tiny enough that a plain class with an RxJS Subject is clearer and adds
 * no new infra concepts.
 */
export class ActivationBus {
  // Finnish notation ($) — repo convention for RxJS streams enforced by eslint.
  private readonly subject$ = new Subject<DocReadActivation>();
  /** sourceId → timestamp ms; LRU-trimmed on insert. */
  private readonly recentSourceIds = new Map<string, number>();

  emit(event: DocReadActivation): void {
    const now = event.ts;
    const seenAt = this.recentSourceIds.get(event.sourceId);
    if (seenAt !== undefined && now - seenAt < DEDUPE_WINDOW_MS) {
      // Duplicate within the window — drop silently. Refresh the timestamp
      // so a continued stream of duplicates keeps the entry warm.
      this.recentSourceIds.set(event.sourceId, now);
      return;
    }
    this.recentSourceIds.set(event.sourceId, now);
    // Bound the LRU so a long-running session can't leak memory.
    if (this.recentSourceIds.size > DEDUPE_LRU_CAP) {
      const oldestKey = this.recentSourceIds.keys().next().value;
      if (oldestKey !== undefined) this.recentSourceIds.delete(oldestKey);
    }
    this.subject$.next(event);
  }

  asObservable() {
    return this.subject$.asObservable();
  }
}

/**
 * Process-wide singleton — there is at most one Knowledge Graph view open
 * at a time per app instance, so a single bus is fine. If we ever need
 * multiple concurrent graph views (e.g. workspace switcher with persistent
 * tabs), this can become workspace-keyed.
 */
let singleton: ActivationBus | null = null;

export function getActivationBus(): ActivationBus {
  if (!singleton) singleton = new ActivationBus();
  return singleton;
}
