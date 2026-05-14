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
export const CLUSTER_BADGE_CAP = 30;

/**
 * Connected-component size containing `docId`. Treats edges as undirected
 * (a link in either direction counts as cluster membership). BFS, capped at
 * `cap` so on a degenerate "everything connects to everything" graph we
 * don't walk the full graph just to render a badge.
 */
export function clusterSize(
  docId: string,
  edges: ReadonlyArray<NodeDetailEdge>,
  cap: number = CLUSTER_BADGE_CAP
): number {
  // Build an adjacency map once per call. For our typical scale (~100 docs,
  // ~300 edges) this is well within a few ms.
  const adj = new Map<string, Set<string>>();
  for (const e of edges) {
    if (!adj.has(e.source)) adj.set(e.source, new Set());
    if (!adj.has(e.target)) adj.set(e.target, new Set());
    adj.get(e.source)?.add(e.target);
    adj.get(e.target)?.add(e.source);
  }

  const seen = new Set<string>([docId]);
  const queue = [docId];
  while (queue.length > 0 && seen.size <= cap) {
    const cur = queue.shift();
    if (cur === undefined) break;
    const neighbours = adj.get(cur);
    if (!neighbours) continue;
    for (const n of neighbours) {
      if (seen.has(n)) continue;
      seen.add(n);
      queue.push(n);
      if (seen.size > cap) break;
    }
  }
  return seen.size;
}

/**
 * Convert a node's hueShift (0..2π) to a CSS rgb string that mirrors the
 * halo gradient in graph-view.tsx. Warm shifts get a pale gold, cool shifts
 * get a pale blue-white. Same palette as the canvas so the swatch + node
 * read as "the same thing".
 */
export function hueShiftToSwatch(hueShift: number): string {
  const warm = Math.sin(hueShift) > 0;
  return warm ? 'rgb(220, 200, 170)' : 'rgb(170, 200, 240)';
}

/**
 * Format an epoch-ms timestamp as a relative "Ns ago" / "Nm ago" string. We
 * deliberately stop at minutes — anything older than the activity window
 * (60s by default) is pruned upstream, so a "59s ago" worst-case is the
 * largest value this ever renders.
 */
export function formatRelativeTimestamp(
  timestampMs: number,
  nowMs: number
): string {
  const deltaSec = Math.max(0, Math.round((nowMs - timestampMs) / 1000));
  if (deltaSec < 5) return 'just now';
  if (deltaSec < 60) return `${deltaSec}s ago`;
  const minutes = Math.floor(deltaSec / 60);
  return `${minutes}m ago`;
}

/**
 * Build the sorted outgoing/incoming link lists for `selectedId`. Pure
 * over the edge list — the panel uses this to render the lists, the tests
 * use it directly. Pulled out of the React render so it stays unit-testable
 * even when the vanilla-extract style sheet (imported by the panel itself)
 * can't be loaded in the test runner.
 */
export interface NodeDetailLinkLists {
  outgoing: { id: string; title: string }[];
  incoming: { id: string; title: string }[];
}

export function buildLinkLists(
  selectedId: string,
  edges: ReadonlyArray<NodeDetailEdge>,
  titleForId: (id: string) => string
): NodeDetailLinkLists {
  const outgoing: { id: string; title: string }[] = [];
  const incoming: { id: string; title: string }[] = [];
  const seenOut = new Set<string>();
  const seenIn = new Set<string>();
  for (const e of edges) {
    if (e.source === selectedId && !seenOut.has(e.target)) {
      seenOut.add(e.target);
      outgoing.push({ id: e.target, title: titleForId(e.target) });
    } else if (e.target === selectedId && !seenIn.has(e.source)) {
      seenIn.add(e.source);
      incoming.push({ id: e.source, title: titleForId(e.source) });
    }
  }
  const sorter = (a: { title: string }, b: { title: string }) =>
    a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
  outgoing.sort(sorter);
  incoming.sort(sorter);
  return { outgoing, incoming };
}
