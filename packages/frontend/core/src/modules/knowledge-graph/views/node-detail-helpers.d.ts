/**
 * Pure helpers consumed by `node-detail-panel.tsx`.
 *
 * Pulled into a vanilla-extract-free module so they're trivially unit-testable
 * — the panel module itself imports a `.css.ts` style sheet, which the
 * project's vitest setup can't resolve without the vite plugin context.
 *
 * Keep this file React-free and side-effect-free.
 */
export interface NodeDetailEdge {
    source: string;
    target: string;
}
/** Largest cluster size the badge shows verbatim. Beyond this we say "30+". */
export declare const CLUSTER_BADGE_CAP = 30;
/**
 * Connected-component size containing `docId`. Treats edges as undirected
 * (a link in either direction counts as cluster membership). BFS, capped at
 * `cap` so on a degenerate "everything connects to everything" graph we
 * don't walk the full graph just to render a badge.
 */
export declare function clusterSize(docId: string, edges: ReadonlyArray<NodeDetailEdge>, cap?: number): number;
/**
 * Convert a node's hueShift (0..2π) to a CSS rgb string that mirrors the
 * halo gradient in graph-view.tsx. Warm shifts get a pale gold, cool shifts
 * get a pale blue-white. Same palette as the canvas so the swatch + node
 * read as "the same thing".
 */
export declare function hueShiftToSwatch(hueShift: number): string;
/**
 * Format an epoch-ms timestamp as a relative "Ns ago" / "Nm ago" string. We
 * deliberately stop at minutes — anything older than the activity window
 * (60s by default) is pruned upstream, so a "59s ago" worst-case is the
 * largest value this ever renders.
 */
export declare function formatRelativeTimestamp(timestampMs: number, nowMs: number): string;
/**
 * Build the sorted outgoing/incoming link lists for `selectedId`. Pure
 * over the edge list — the panel uses this to render the lists, the tests
 * use it directly. Pulled out of the React render so it stays unit-testable
 * even when the vanilla-extract style sheet (imported by the panel itself)
 * can't be loaded in the test runner.
 */
export interface NodeDetailLinkLists {
    outgoing: {
        id: string;
        title: string;
    }[];
    incoming: {
        id: string;
        title: string;
    }[];
}
export declare function buildLinkLists(selectedId: string, edges: ReadonlyArray<NodeDetailEdge>, titleForId: (id: string) => string): NodeDetailLinkLists;
//# sourceMappingURL=node-detail-helpers.d.ts.map