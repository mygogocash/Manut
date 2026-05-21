/**
 * Pure functions used by the Knowledge Graph view. Lifted out of the
 * view module so they can be unit-tested without pulling in the entire
 * React + Lit + BlockSuite import chain.
 *
 * Nothing here touches the DOM, RxJS, or any AFFiNE service.
 */
/**
 * Lobe colour palette — five perceptually-uniform low-saturation hues. Each
 * cluster discovered by `labelPropagation` is mapped onto one of these by
 * its compacted index (largest cluster = palette[0], etc.). Tuned to read
 * clearly on both light and dark backgrounds.
 */
export interface LobeColour {
    /** [r, g, b] used on dark backgrounds. */
    dark: readonly [number, number, number];
    /** [r, g, b] used on light backgrounds. */
    light: readonly [number, number, number];
}
export declare const LOBE_PALETTE: readonly LobeColour[];
export declare const FALLBACK_LOBE: LobeColour;
export declare function lobeColour(cluster: number): LobeColour;
/**
 * Single-pass synchronous label propagation. Each node adopts the most
 * common label among its neighbours; ties broken by the lowest neighbour
 * id (deterministic). Converges fast on sparse graphs; capped at 8 iters
 * because the canvas re-runs this whenever edges change anyway.
 *
 * Returns a `Map<nodeId, clusterIndex>` where 0 is the LARGEST cluster, 1
 * is next, etc. (compacted post-pass so palette assignment is stable).
 */
export declare function labelPropagation(nodeIds: readonly string[], edges: readonly {
    source: string;
    target: string;
}[], maxIters?: number): Map<string, number>;
/**
 * Deterministic curvature offset per edge — same edge always gets the same
 * curve direction and magnitude across re-renders.
 */
export declare function curveOffsetFor(source: string, target: string): number;
//# sourceMappingURL=graph-math.d.ts.map