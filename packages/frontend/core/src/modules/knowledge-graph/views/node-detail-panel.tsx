import { useI18n } from '@affine/i18n';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import type { ActivityEvent } from '../services/activity-buffer';
import {
  buildLinkLists,
  CLUSTER_BADGE_CAP,
  clusterSize,
  formatRelativeTimestamp,
  hueShiftToSwatch,
  type NodeDetailEdge,
} from './node-detail-helpers';
import * as styles from './node-detail-panel.css';

// Re-export the helpers + edge type so consumers (graph-view, tests) can pull
// them from a single entry point.
export type { NodeDetailEdge } from './node-detail-helpers';
export {
  buildLinkLists,
  clusterSize,
  formatRelativeTimestamp,
  hueShiftToSwatch,
} from './node-detail-helpers';

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
export const NodeDetailPanel = ({
  selectedId,
  nodes,
  edges,
  docTitlesById,
  recentActivity,
  onOpenDoc,
  onOpenPeek,
  onClose,
  now,
}: NodeDetailPanelProps) => {
  const t = useI18n();
  const titleButtonRef = useRef<HTMLButtonElement>(null);

  const isOpen = selectedId !== null;

  // Focus the title button when the panel opens — gives keyboard users an
  // anchor inside the panel without trapping focus.
  useEffect(() => {
    if (isOpen) {
      titleButtonRef.current?.focus({ preventScroll: true });
    }
  }, [isOpen, selectedId]);

  const node = useMemo(() => {
    if (!selectedId) return null;
    return nodes.find(n => n.id === selectedId) ?? null;
  }, [nodes, selectedId]);

  const title = useMemo(() => {
    if (!selectedId) return '';
    return docTitlesById.get(selectedId) ?? node?.title ?? 'Untitled';
  }, [docTitlesById, node, selectedId]);

  const titleForId = useCallback(
    (id: string) =>
      docTitlesById.get(id) ??
      nodes.find(n => n.id === id)?.title ??
      'Untitled',
    [docTitlesById, nodes]
  );

  const { outgoing, incoming } = useMemo(() => {
    if (!selectedId) return { outgoing: [], incoming: [] };
    return buildLinkLists(selectedId, edges, titleForId);
  }, [edges, selectedId, titleForId]);

  const cluster = useMemo(() => {
    if (!selectedId) return 1;
    return clusterSize(selectedId, edges);
  }, [edges, selectedId]);

  const clusterLabel = useMemo(() => {
    if (cluster <= 1) {
      // Orphan — bypass i18n placeholder interpolation entirely so the
      // fallback path stays readable.
      return t.t('com.manut.knowledgeGraph.detail.orphan');
    }
    const size =
      cluster > CLUSTER_BADGE_CAP ? `${CLUSTER_BADGE_CAP}+` : cluster;
    // `t.t(key, options)` (rather than `t[key]({...})`) — the typed proxy
    // signature `() => string` for an unknown key doesn't accept the options
    // argument the runtime *does* support. Using the underlying `.t()` keeps
    // TS happy on freshly-added keys without re-running codegen.
    return t.t('com.manut.knowledgeGraph.detail.cluster', {
      size: String(size),
    });
  }, [cluster, t]);

  const swatchColour = useMemo(
    () => (node ? hueShiftToSwatch(node.hueShift) : 'rgb(170, 200, 240)'),
    [node]
  );

  const nowFn = now ?? Date.now;
  // Re-render activity timestamps every 10s so "5s ago" doesn't go stale.
  // Cheap — only runs while the panel is open.
  const tickRef = useRef(0);
  useEffect(() => {
    if (!isOpen) return;
    const id = setInterval(() => {
      tickRef.current++;
    }, 10_000);
    return () => clearInterval(id);
  }, [isOpen]);

  const handleOpenTitle = useCallback(() => {
    if (selectedId) onOpenDoc(selectedId);
  }, [selectedId, onOpenDoc]);

  const handleOpenLink = useCallback(
    (id: string) => {
      onOpenDoc(id);
    },
    [onOpenDoc]
  );

  const handleOpenPeekClick = useCallback(() => {
    if (selectedId) onOpenPeek(selectedId);
  }, [selectedId, onOpenPeek]);

  return (
    <div
      // `inert` (HTML global) takes the whole subtree out of the focus order,
      // hides it from AT, and blocks pointer events when set — necessary
      // because the panel stays mounted under translateX(100%). React 19
      // types declare `inert` as boolean; the DOM checks attribute presence,
      // so `true` flips it on and `undefined` removes the attribute (NOT
      // `false`, which keeps the attribute with value "false").
      inert={isOpen ? undefined : true}
      aria-hidden={isOpen ? undefined : true}
      className={`${styles.root} ${isOpen ? styles.rootOpen : styles.rootClosed}`}
      data-testid="knowledge-graph-node-detail-panel"
    >
      <div className={styles.header}>
        <button
          ref={titleButtonRef}
          type="button"
          className={styles.titleButton}
          onClick={handleOpenTitle}
          aria-label={t.t('com.manut.knowledgeGraph.detail.openDoc', {
            title,
          })}
          data-testid="knowledge-graph-node-detail-title"
        >
          {title}
        </button>
        <button
          type="button"
          aria-label={t.t('com.manut.knowledgeGraph.detail.close')}
          onClick={onClose}
          className={styles.closeButton}
          data-testid="knowledge-graph-node-detail-close"
        >
          ×
        </button>
      </div>

      <div className={styles.metaRow}>
        <span
          className={styles.colourSwatch}
          style={{ background: swatchColour }}
          aria-hidden="true"
          data-testid="knowledge-graph-node-detail-swatch"
        />
        <span
          className={styles.clusterBadge}
          data-testid="knowledge-graph-node-detail-cluster"
        >
          {clusterLabel}
        </span>
      </div>

      <section>
        <h3 className={styles.sectionTitle}>
          {t.t('com.manut.knowledgeGraph.detail.outgoing', {
            count: String(outgoing.length),
          })}
        </h3>
        {outgoing.length === 0 ? (
          <div className={styles.emptyLine}>
            {t.t('com.manut.knowledgeGraph.detail.noOutgoing')}
          </div>
        ) : (
          <ul
            className={styles.linkList}
            data-testid="knowledge-graph-node-detail-outgoing"
          >
            {outgoing.map(link => (
              <li key={link.id}>
                <button
                  type="button"
                  className={styles.linkButton}
                  onClick={() => handleOpenLink(link.id)}
                >
                  {link.title}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className={styles.sectionTitle}>
          {t.t('com.manut.knowledgeGraph.detail.incoming', {
            count: String(incoming.length),
          })}
        </h3>
        {incoming.length === 0 ? (
          <div className={styles.emptyLine}>
            {t.t('com.manut.knowledgeGraph.detail.noIncoming')}
          </div>
        ) : (
          <ul
            className={styles.linkList}
            data-testid="knowledge-graph-node-detail-incoming"
          >
            {incoming.map(link => (
              <li key={link.id}>
                <button
                  type="button"
                  className={styles.linkButton}
                  onClick={() => handleOpenLink(link.id)}
                >
                  {link.title}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className={styles.sectionTitle}>
          {t.t('com.manut.knowledgeGraph.detail.recentActivity')}
        </h3>
        {recentActivity.length === 0 ? (
          <div className={styles.emptyLine}>
            {t.t('com.manut.knowledgeGraph.detail.noActivity')}
          </div>
        ) : (
          <ul
            className={styles.activityList}
            data-testid="knowledge-graph-node-detail-activity"
          >
            {recentActivity.map((event, index) => (
              <li
                key={`${event.timestamp}-${event.toolName}-${index}`}
                className={styles.activityRow}
              >
                <div className={styles.activityHead}>
                  <span>
                    <span className={styles.activityTool}>
                      {event.toolName}
                    </span>
                    {event.agentLabel ? (
                      <span className={styles.activityAgent}>
                        {' '}
                        · {event.agentLabel}
                      </span>
                    ) : null}
                  </span>
                  <span className={styles.activityTimestamp}>
                    {formatRelativeTimestamp(event.timestamp, nowFn())}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className={styles.buttonRow}>
        <button
          type="button"
          onClick={handleOpenTitle}
          className={styles.primaryButton}
        >
          {t.t('com.manut.knowledgeGraph.detail.openDocumentButton')}
        </button>
        <button
          type="button"
          onClick={handleOpenPeekClick}
          className={styles.secondaryButton}
        >
          {t.t('com.manut.knowledgeGraph.detail.openPeekButton')}
        </button>
      </div>
    </div>
  );
};
