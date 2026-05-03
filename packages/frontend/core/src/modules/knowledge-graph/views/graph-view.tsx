import { DocsService } from '@affine/core/modules/doc';
import { DocsSearchService } from '@affine/core/modules/docs-search';
import { WorkbenchService } from '@affine/core/modules/workbench';
import { useLiveData, useService } from '@toeverything/infra';
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { combineLatest, map, of, switchMap } from 'rxjs';

interface GraphNode {
  id: string;
  title: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface GraphEdge {
  source: string;
  target: string;
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

const NODE_RADIUS = 6;
const NODE_RADIUS_HOVER = 9;
const REPULSION = 1800;
const SPRING_LENGTH = 110;
const SPRING_K = 0.02;
const DAMPING = 0.85;
const CENTER_PULL = 0.005;

const emptyStateMessage =
  'Graph view is ready — link some docs together using @-mentions to see the connections appear here.';

const containerStyle: CSSProperties = {
  position: 'relative',
  width: '100%',
  height: '100%',
  minHeight: 400,
  flex: 1,
  overflow: 'hidden',
  background: 'var(--affine-background-primary-color, #fff)',
};

const canvasStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  height: '100%',
  cursor: 'grab',
};

const emptyStateStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 32,
  textAlign: 'center',
  color: 'var(--affine-text-secondary-color, #888)',
  fontSize: 14,
  pointerEvents: 'none',
};

const titleStyle: CSSProperties = {
  position: 'absolute',
  top: 16,
  left: 16,
  fontSize: 18,
  fontWeight: 600,
  color: 'var(--affine-text-primary-color, #111)',
  pointerEvents: 'none',
};

const subtitleStyle: CSSProperties = {
  position: 'absolute',
  top: 44,
  left: 16,
  fontSize: 12,
  color: 'var(--affine-text-secondary-color, #888)',
  pointerEvents: 'none',
};

/**
 * Knowledge Graph view (Obsidian-style). Renders all non-trash docs as nodes
 * and the @-mention / linked-doc references between them as edges, using a
 * lightweight force-directed layout drawn directly on a 2D canvas (no extra
 * dependencies).
 */
export const KnowledgeGraphView = () => {
  const docsService = useService(DocsService);
  const docsSearchService = useService(DocsSearchService);
  const workbenchService = useService(WorkbenchService);

  const docs = useLiveData(docsService.list.docs$);
  const nonTrashIds = useLiveData(docsService.list.nonTrashDocsIds$);

  const docTitlesById = useMemo(() => {
    const map = new Map<string, string>();
    for (const doc of docs) {
      if (!nonTrashIds.includes(doc.id)) continue;
      map.set(doc.id, doc.title$.value || 'Untitled');
    }
    return map;
  }, [docs, nonTrashIds]);

  const [edges, setEdges] = useState<GraphEdge[]>([]);

  // Build edges by querying refs FROM each non-trash doc.
  // We rely on DocsSearchService.watchRefsFrom which reads from the indexer.
  useEffect(() => {
    if (nonTrashIds.length === 0) {
      setEdges([]);
      return;
    }

    // For each source doc, get its outgoing refs. Combine into a single edge list.
    const perDoc$ = nonTrashIds.map(sourceId =>
      docsSearchService.watchRefsFrom(sourceId).pipe(
        map(refs =>
          refs
            .filter(r => docTitlesById.has(r.docId) && r.docId !== sourceId)
            .map(r => ({ source: sourceId, target: r.docId }))
        )
      )
    );

    const sub = (perDoc$.length > 0 ? combineLatest(perDoc$) : of([]))
      .pipe(switchMap(arrs => of(arrs.flat())))
      .subscribe(allEdges => {
        // De-duplicate (in case both directions exist).
        const seen = new Set<string>();
        const deduped: GraphEdge[] = [];
        for (const e of allEdges) {
          const key =
            e.source < e.target
              ? `${e.source}|${e.target}`
              : `${e.target}|${e.source}`;
          if (seen.has(key)) continue;
          seen.add(key);
          deduped.push(e);
        }
        setEdges(deduped);
      });

    return () => sub.unsubscribe();
  }, [docsSearchService, nonTrashIds, docTitlesById]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<GraphData>({ nodes: [], edges: [] });
  const animationRef = useRef<number | null>(null);
  const hoverIdRef = useRef<string | null>(null);
  const draggingRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(
    null
  );

  // Rebuild nodes whenever the doc set changes (preserve positions for existing).
  useEffect(() => {
    const prev = new Map(stateRef.current.nodes.map(n => [n.id, n]));
    const ids = Array.from(docTitlesById.keys());
    const width = containerRef.current?.clientWidth ?? 800;
    const height = containerRef.current?.clientHeight ?? 600;
    const cx = width / 2;
    const cy = height / 2;
    const r = Math.min(width, height) * 0.35;

    const nodes: GraphNode[] = ids.map((id, i) => {
      const existing = prev.get(id);
      if (existing) {
        return { ...existing, title: docTitlesById.get(id) ?? 'Untitled' };
      }
      const angle = (i / Math.max(1, ids.length)) * Math.PI * 2;
      return {
        id,
        title: docTitlesById.get(id) ?? 'Untitled',
        x: cx + Math.cos(angle) * r,
        y: cy + Math.sin(angle) * r,
        vx: 0,
        vy: 0,
      };
    });

    stateRef.current = { nodes, edges: stateRef.current.edges };
  }, [docTitlesById]);

  useEffect(() => {
    stateRef.current = { ...stateRef.current, edges };
  }, [edges]);

  const navigateToDoc = useCallback(
    (docId: string) => {
      workbenchService.workbench.openDoc(docId);
    },
    [workbenchService]
  );

  // Force-directed simulation + render loop.
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(container);

    const step = () => {
      const { nodes, edges } = stateRef.current;
      const w = container.clientWidth;
      const h = container.clientHeight;
      const cx = w / 2;
      const cy = h / 2;

      // Repulsion (all pairs).
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const distSq = dx * dx + dy * dy + 0.01;
          const dist = Math.sqrt(distSq);
          const force = REPULSION / distSq;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          a.vx -= fx;
          a.vy -= fy;
          b.vx += fx;
          b.vy += fy;
        }
      }

      // Spring (edges).
      const nodeMap = new Map(nodes.map(n => [n.id, n]));
      for (const e of edges) {
        const a = nodeMap.get(e.source);
        const b = nodeMap.get(e.target);
        if (!a || !b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) + 0.01;
        const diff = dist - SPRING_LENGTH;
        const fx = (dx / dist) * diff * SPRING_K;
        const fy = (dy / dist) * diff * SPRING_K;
        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      }

      // Center pull + integrate.
      const dragId = draggingRef.current?.id;
      for (const n of nodes) {
        if (n.id === dragId) {
          n.vx = 0;
          n.vy = 0;
          continue;
        }
        n.vx += (cx - n.x) * CENTER_PULL;
        n.vy += (cy - n.y) * CENTER_PULL;
        n.vx *= DAMPING;
        n.vy *= DAMPING;
        n.x += n.vx;
        n.y += n.vy;
      }

      // Draw.
      ctx.clearRect(0, 0, w, h);

      // Edges.
      ctx.lineWidth = 1;
      ctx.strokeStyle =
        getComputedStyle(container).getPropertyValue(
          '--affine-border-color'
        ) || 'rgba(120, 120, 120, 0.4)';
      for (const e of edges) {
        const a = nodeMap.get(e.source);
        const b = nodeMap.get(e.target);
        if (!a || !b) continue;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }

      // Nodes.
      const hoverId = hoverIdRef.current;
      const accent =
        getComputedStyle(container).getPropertyValue(
          '--affine-primary-color'
        ) || '#1e96eb';
      const muted =
        getComputedStyle(container).getPropertyValue(
          '--affine-text-secondary-color'
        ) || '#7f8a99';

      for (const n of nodes) {
        const isHover = n.id === hoverId;
        ctx.beginPath();
        ctx.arc(
          n.x,
          n.y,
          isHover ? NODE_RADIUS_HOVER : NODE_RADIUS,
          0,
          Math.PI * 2
        );
        ctx.fillStyle = isHover ? accent : muted;
        ctx.fill();
        if (isHover) {
          ctx.font =
            '12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
          ctx.fillStyle =
            getComputedStyle(container).getPropertyValue(
              '--affine-text-primary-color'
            ) || '#111';
          ctx.fillText(n.title, n.x + 12, n.y + 4);
        }
      }

      animationRef.current = requestAnimationFrame(step);
    };

    animationRef.current = requestAnimationFrame(step);

    return () => {
      ro.disconnect();
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const findHit = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    for (const n of stateRef.current.nodes) {
      const dx = n.x - x;
      const dy = n.y - y;
      if (dx * dx + dy * dy <= NODE_RADIUS_HOVER * NODE_RADIUS_HOVER * 2) {
        return { node: n, x, y };
      }
    }
    return null;
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const drag = draggingRef.current;
      if (drag) {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const node = stateRef.current.nodes.find(n => n.id === drag.id);
        if (node) {
          node.x = e.clientX - rect.left + drag.offsetX;
          node.y = e.clientY - rect.top + drag.offsetY;
        }
        return;
      }
      const hit = findHit(e.clientX, e.clientY);
      hoverIdRef.current = hit?.node.id ?? null;
      const canvas = canvasRef.current;
      if (canvas) canvas.style.cursor = hit ? 'pointer' : 'grab';
    },
    [findHit]
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const hit = findHit(e.clientX, e.clientY);
      if (!hit) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.setPointerCapture(e.pointerId);
      const rect = canvas.getBoundingClientRect();
      draggingRef.current = {
        id: hit.node.id,
        offsetX: hit.node.x - (e.clientX - rect.left),
        offsetY: hit.node.y - (e.clientY - rect.top),
      };
    },
    [findHit]
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      const drag = draggingRef.current;
      draggingRef.current = null;
      if (canvas) canvas.releasePointerCapture(e.pointerId);
      // Treat as a click if movement was tiny.
      if (drag) {
        const node = stateRef.current.nodes.find(n => n.id === drag.id);
        if (!node) return;
        const rect = canvas?.getBoundingClientRect();
        if (!rect) return;
        const dx = node.x - (e.clientX - rect.left + drag.offsetX);
        const dy = node.y - (e.clientY - rect.top + drag.offsetY);
        if (dx * dx + dy * dy < 9) {
          navigateToDoc(drag.id);
        }
      }
    },
    [navigateToDoc]
  );

  const isEmpty = docTitlesById.size === 0 || edges.length === 0;

  return (
    <div ref={containerRef} style={containerStyle}>
      <div style={titleStyle}>Knowledge Graph</div>
      <div style={subtitleStyle}>
        {docTitlesById.size} doc{docTitlesById.size === 1 ? '' : 's'} ·{' '}
        {edges.length} link{edges.length === 1 ? '' : 's'}
      </div>
      <canvas
        ref={canvasRef}
        style={canvasStyle}
        onPointerMove={onPointerMove}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
      {isEmpty && <div style={emptyStateStyle}>{emptyStateMessage}</div>}
    </div>
  );
};
