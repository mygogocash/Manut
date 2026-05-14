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

export const LOBE_PALETTE: readonly LobeColour[] = [
  { dark: [255, 138, 128], light: [200, 80, 70] }, // cinnabar
  { dark: [255, 196, 120], light: [205, 140, 60] }, // amber
  { dark: [120, 220, 200], light: [40, 140, 130] }, // teal
  { dark: [160, 168, 255], light: [90, 100, 200] }, // iris
  { dark: [232, 150, 220], light: [170, 80, 160] }, // magenta
];

export const FALLBACK_LOBE: LobeColour = {
  dark: [200, 210, 230],
  light: [110, 130, 170],
};

export function lobeColour(cluster: number): LobeColour {
  if (cluster < 0) return FALLBACK_LOBE;
  return LOBE_PALETTE[cluster % LOBE_PALETTE.length];
}

/**
 * Single-pass synchronous label propagation. Each node adopts the most
 * common label among its neighbours; ties broken by the lowest neighbour
 * id (deterministic). Converges fast on sparse graphs; capped at 8 iters
 * because the canvas re-runs this whenever edges change anyway.
 *
 * Returns a `Map<nodeId, clusterIndex>` where 0 is the LARGEST cluster, 1
 * is next, etc. (compacted post-pass so palette assignment is stable).
 */
export function labelPropagation(
  nodeIds: readonly string[],
  edges: readonly { source: string; target: string }[],
  maxIters = 8
): Map<string, number> {
  // Adjacency lists.
  const adj = new Map<string, string[]>();
  for (const id of nodeIds) adj.set(id, []);
  for (const e of edges) {
    adj.get(e.source)?.push(e.target);
    adj.get(e.target)?.push(e.source);
  }

  // Initial labels: deterministic — use the node's own index. Stable across
  // re-renders so the cluster colouring doesn't dance around on reload.
  const indexOf = new Map<string, number>();
  nodeIds.forEach((id, i) => indexOf.set(id, i));
  const labels = new Map<string, number>(
    nodeIds.map(id => [id, indexOf.get(id) ?? 0])
  );

  for (let iter = 0; iter < maxIters; iter++) {
    let changed = false;
    for (const id of nodeIds) {
      const neighbours = adj.get(id);
      if (!neighbours || neighbours.length === 0) continue;
      const tally = new Map<number, number>();
      for (const nb of neighbours) {
        const lbl = labels.get(nb);
        if (lbl === undefined) continue;
        tally.set(lbl, (tally.get(lbl) ?? 0) + 1);
      }
      let bestLbl = labels.get(id) ?? 0;
      let bestCount = -1;
      for (const [lbl, count] of tally) {
        if (count > bestCount || (count === bestCount && lbl < bestLbl)) {
          bestLbl = lbl;
          bestCount = count;
        }
      }
      if (bestLbl !== labels.get(id)) {
        labels.set(id, bestLbl);
        changed = true;
      }
    }
    if (!changed) break;
  }

  // Compact: largest cluster becomes 0, next 1, etc.
  const counts = new Map<number, number>();
  for (const lbl of labels.values()) {
    counts.set(lbl, (counts.get(lbl) ?? 0) + 1);
  }
  const ranked = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  const remap = new Map(ranked.map(([lbl], i) => [lbl, i]));
  for (const [id, lbl] of labels) {
    labels.set(id, remap.get(lbl) ?? 0);
  }
  return labels;
}

/**
 * Deterministic curvature offset per edge — same edge always gets the same
 * curve direction and magnitude across re-renders.
 */
export function curveOffsetFor(source: string, target: string): number {
  const key = source < target ? `${source}|${target}` : `${target}|${source}`;
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  const magnitude = 18 + (Math.abs(hash) % 22); // 18..40 px
  return (hash & 1) === 0 ? magnitude : -magnitude;
}
