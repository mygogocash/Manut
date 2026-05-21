import type { ActivityEvent } from '../services/activity-buffer';
import { type NodeDetailEdge } from './node-detail-helpers';
export type { NodeDetailEdge } from './node-detail-helpers';
export { buildLinkLists, clusterSize, formatRelativeTimestamp, hueShiftToSwatch, } from './node-detail-helpers';
/**
 * Minimum shape the panel needs from a graph node. The full GraphNode in
 * `graph-view.tsx` has physics state (vx/vy/twinklePhase/…) which the panel
 * never touches — keep the prop type narrow so tests don't have to fabricate
 * a simulation tick worth of state.
 */
export interface NodeDetailNode {
    id: string;
    title: string;
    /** 0..2π — used for the colour swatch (matches the halo tint in graph-view). */
    hueShift: number;
}
export interface NodeDetailPanelProps {
    /** Doc id whose detail to render. `null` collapses the panel. */
    selectedId: string | null;
    /** Nodes currently in the simulation. Indexed by id. */
    nodes: ReadonlyArray<NodeDetailNode>;
    /** Edge list (directed: source → target). */
    edges: ReadonlyArray<NodeDetailEdge>;
    /** Map of all known doc titles. Falls back to nodes[].title if missing. */
    docTitlesById: ReadonlyMap<string, string>;
    /** Recent activity events for `selectedId`. Newest first. */
    recentActivity: ReadonlyArray<ActivityEvent>;
    /** Open the doc in the workbench (no specific mode). */
    onOpenDoc: (docId: string) => void;
    /** Open the doc in peek view (modal-style). */
    onOpenPeek: (docId: string) => void;
    /** Dismiss the panel. */
    onClose: () => void;
    /**
     * `Date.now`-equivalent injected so tests can pin time. Falls back to the
     * real clock when omitted.
     */
    now?: () => number;
}
/**
 * Right-side detail panel for the Knowledge Graph view.
 *
 * Renders for the currently-`selectedId` node:
 *   1. Doc title (click → workbench open)
 *   2. Lobe colour swatch + cluster size badge
 *   3. Outgoing links list (alphabetical)
 *   4. Incoming links list (alphabetical)
 *   5. Recent AI activity for this docId (within the buffer's window)
 *   6. Close button + Open document / Open in peek buttons
 *
 * The panel stays mounted when `selectedId` is null so the slide-in / -out
 * animation runs both ways. `inert` + `aria-hidden` keep it out of focus
 * order when collapsed — without those, the buttons stay tab-focusable
 * behind the offscreen translate, which is a real a11y trap.
 */
export declare const NodeDetailPanel: ({ selectedId, nodes, edges, docTitlesById, recentActivity, onOpenDoc, onOpenPeek, onClose, now, }: NodeDetailPanelProps) => import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=node-detail-panel.d.ts.map