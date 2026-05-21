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
    op: 'searchWorkspace' | 'docRead' | 'readingDocs' | 'docEdit' | 'sectionEdit' | 'frontend-local' | 'other';
    /** Optional session / cron job / agent id. Surfaced in tooltips later. */
    agentId?: string;
    /** Epoch ms when the event was created. */
    ts: number;
}
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
export declare class ActivationBus {
    private readonly subject$;
    /** sourceId → timestamp ms; LRU-trimmed on insert. */
    private readonly recentSourceIds;
    emit(event: DocReadActivation): void;
    asObservable(): import("rxjs").Observable<DocReadActivation>;
}
export declare function getActivationBus(): ActivationBus;
//# sourceMappingURL=activation-bus.d.ts.map