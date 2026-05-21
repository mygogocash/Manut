/**
 * Header widget: a tiny persistent canvas that visualises recent
 * Knowledge Graph activation pulses. Lives in the sidebar header next
 * to the workspace switcher — three small dots connected by two faint
 * arcs. Whenever the activation bus emits a doc-read event, a bright
 * synaptic spark runs along one of the arcs over ~600ms.
 *
 * The point is BRAND, not analytics: the Knowledge Graph is the most
 * expressive surface in the app, and this widget folds a sliver of
 * that aesthetic into every page. When the AI reads or edits a doc
 * anywhere in the workspace, the user sees a pulse — ambient
 * confirmation that something is happening.
 *
 * Subscribes to the same singleton `ActivationBus` the full graph view
 * uses, so pulses arrive whether they're emitted by the chat panel
 * optimistically or by the backend SSE stream. No props — fully
 * self-contained.
 *
 * Performance:
 * - Single rAF loop, paused when `document.hidden` so background tabs
 *   don't burn CPU.
 * - devicePixelRatio-aware: backing-store size scales with DPR for
 *   crispness on retina displays without changing the CSS size.
 * - Pulses live in a refed array; capped at ~6 concurrent so a busy
 *   workspace can't accumulate unbounded render cost.
 * - `aria-hidden="true"` — decorative, not announced to screen readers.
 */
export declare const GraphMini: () => React.ReactElement;
//# sourceMappingURL=graph-mini.d.ts.map