import { DocsService } from '@affine/core/modules/doc';
import { DocsSearchService } from '@affine/core/modules/docs-search';
import { PeekViewService } from '@affine/core/modules/peek-view';
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
  /** 0..2π — phase offset so each node twinkles at a different rhythm. */
  twinklePhase: number;
  /** 0.7..1.3 — per-node size multiplier (giant stars vs dwarf stars). */
  scale: number;
  /** 0..2π — slight color hue offset for the halo (warm ↔ cool stars). */
  hueShift: number;
}

interface GraphEdge {
  source: string;
  target: string;
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

interface BgStar {
  /** Normalized 0..1 — multiplied by canvas width at draw time. */
  x: number;
  y: number;
  /** 0..1 base luminosity. */
  brightness: number;
  /** 0..2π — independent twinkle phase. */
  phase: number;
  /** Pixel size at peak twinkle. */
  size: number;
}

// ─── Galaxy tuning ──────────────────────────────────────────────────────────
// Forces are deliberately weak so motion settles into a slow drift rather than
// the snappy "spring back" of a typical force-directed graph. High damping
// preserves momentum so nodes keep coasting between updates.
const NODE_RADIUS = 4.5;
const NODE_RADIUS_HOVER = 7;
const NODE_HALO_MULT = 4; // halo radius = NODE_RADIUS * this
const REPULSION = 700;
const SPRING_LENGTH = 130;
const SPRING_K = 0.008;
const DAMPING = 0.955;
const CENTER_PULL = 0.0009;
/**
 * Tangential acceleration toward (perpendicular-to-radius). This is what gives
 * the layout its galactic spiral — every node gets a tiny sideways nudge,
 * which combined with low damping accumulates into slow orbital motion.
 */
const ORBIT_FORCE = 0.00018;
const ORBIT_FORCE_MAX_R = 260; // beyond this, orbit force stops growing
/** Cap on per-axis velocity so a wild burst can never spin nodes off-screen. */
const MAX_VELOCITY = 1.4;

const BG_STAR_FAR_COUNT = 90;
const BG_STAR_NEAR_COUNT = 35;
/** Drift speed (normalized x-units per second) for parallax starfield layers. */
const BG_DRIFT_FAR = 0.0015;
const BG_DRIFT_NEAR = 0.004;

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
  // Soft halo so the title stays legible over the starfield+nebula.
  textShadow: '0 0 8px var(--affine-background-primary-color, rgba(0,0,0,0.6))',
  letterSpacing: '0.01em',
};

const subtitleStyle: CSSProperties = {
  position: 'absolute',
  top: 44,
  left: 16,
  fontSize: 12,
  color: 'var(--affine-text-secondary-color, #888)',
  pointerEvents: 'none',
  textShadow: '0 0 6px var(--affine-background-primary-color, rgba(0,0,0,0.5))',
};

// ─── Utilities ──────────────────────────────────────────────────────────────

/** Deterministic small-state PRNG so the starfield is identical across renders. */
function mulberry32(seed: number) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Read the resolved background colour and return whether we're on a dark
 * theme. Used to bias the galaxy palette — brighter accents on dark, paler
 * accents on light — without having to hard-code a theme.
 */
function isDarkBackground(el: HTMLElement): boolean {
  const bg = getComputedStyle(el).getPropertyValue(
    '--affine-background-primary-color'
  );
  const rgbMatch = /rgb\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(bg);
  const hexMatch = /#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(bg);
  let r = 0;
  let g = 0;
  let b = 0;
  if (rgbMatch) {
    r = +rgbMatch[1];
    g = +rgbMatch[2];
    b = +rgbMatch[3];
  } else if (hexMatch) {
    r = parseInt(hexMatch[1], 16);
    g = parseInt(hexMatch[2], 16);
    b = parseInt(hexMatch[3], 16);
  } else {
    return false;
  }
  // Rec. 709 luma.
  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luma < 128;
}

/**
 * Knowledge Graph view (Obsidian-style, but more galactic). Renders all
 * non-trash docs as star-like nodes and the @-mention / linked-doc references
 * between them as faint constellation lines, drawn directly on a 2D canvas.
 *
 * The simulation is a force-directed layout with three forces — pairwise
 * repulsion, edge spring, and a centring pull — plus a small tangential
 * "orbit" force that makes the whole graph drift slowly around its centroid
 * like a spiral galaxy. Damping is high (0.955) so nodes coast gracefully
 * between updates rather than snapping to rest.
 */
export const KnowledgeGraphView = () => {
  const docsService = useService(DocsService);
  const docsSearchService = useService(DocsSearchService);
  const workbenchService = useService(WorkbenchService);
  const peekViewService = useService(PeekViewService);

  const docs = useLiveData(docsService.list.docs$);
  const nonTrashIds = useLiveData(docsService.list.nonTrashDocsIds$);

  // Selected node id for the right-side preview panel. `null` = panel hidden.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Mirror into a ref so the long-lived canvas draw loop (which only mounts
  // once) can read the current selection without being re-bound every render.
  const selectedIdRef = useRef<string | null>(null);
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

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
    const perDocStreams = nonTrashIds.map(sourceId =>
      docsSearchService
        .watchRefsFrom(sourceId)
        .pipe(
          map(refs =>
            refs
              .filter(r => docTitlesById.has(r.docId) && r.docId !== sourceId)
              .map(r => ({ source: sourceId, target: r.docId }))
          )
        )
    );

    const sub = (
      perDocStreams.length > 0 ? combineLatest(perDocStreams) : of([])
    )
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
  const draggingRef = useRef<{
    id: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  // Background starfield — generated once, deterministic, drifts on render.
  const bgStarsRef = useRef<{ far: BgStar[]; near: BgStar[] } | null>(null);
  if (bgStarsRef.current === null) {
    const rng = mulberry32(0xc0ffee);
    const gen = (n: number, sizeMin: number, sizeMax: number): BgStar[] =>
      Array.from({ length: n }, () => ({
        x: rng(),
        y: rng(),
        brightness: 0.25 + rng() * 0.75,
        phase: rng() * Math.PI * 2,
        size: sizeMin + rng() * (sizeMax - sizeMin),
      }));
    bgStarsRef.current = {
      far: gen(BG_STAR_FAR_COUNT, 0.6, 1.2),
      near: gen(BG_STAR_NEAR_COUNT, 1.0, 1.8),
    };
  }

  // Rebuild nodes whenever the doc set changes (preserve positions for existing).
  useEffect(() => {
    const prev = new Map(stateRef.current.nodes.map(n => [n.id, n]));
    const ids = Array.from(docTitlesById.keys());
    const width = containerRef.current?.clientWidth ?? 800;
    const height = containerRef.current?.clientHeight ?? 600;
    const cx = width / 2;
    const cy = height / 2;
    const r = Math.min(width, height) * 0.35;
    const rng = mulberry32(0x5eed);

    const nodes: GraphNode[] = ids.map((id, i) => {
      const existing = prev.get(id);
      if (existing) {
        return { ...existing, title: docTitlesById.get(id) ?? 'Untitled' };
      }
      const angle = (i / Math.max(1, ids.length)) * Math.PI * 2;
      // Slight radial jitter so the initial ring doesn't look mechanical.
      const jitter = 1 + (rng() - 0.5) * 0.15;
      return {
        id,
        title: docTitlesById.get(id) ?? 'Untitled',
        x: cx + Math.cos(angle) * r * jitter,
        y: cy + Math.sin(angle) * r * jitter,
        vx: 0,
        vy: 0,
        twinklePhase: rng() * Math.PI * 2,
        scale: 0.7 + rng() * 0.6, // 0.7..1.3
        hueShift: rng() * Math.PI * 2,
      };
    });

    stateRef.current = { nodes, edges: stateRef.current.edges };
  }, [docTitlesById]);

  useEffect(() => {
    stateRef.current = { ...stateRef.current, edges };
  }, [edges]);

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
      const tSec = performance.now() / 1000;

      const { nodes, edges } = stateRef.current;
      const w = container.clientWidth;
      const h = container.clientHeight;
      const cx = w / 2;
      const cy = h / 2;

      // ─── Physics ─────────────────────────────────────────────────────────
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

      // Center pull + tangential orbit + integrate.
      const dragId = draggingRef.current?.id;
      for (const n of nodes) {
        if (n.id === dragId) {
          n.vx = 0;
          n.vy = 0;
          continue;
        }
        const rdx = n.x - cx;
        const rdy = n.y - cy;
        const r = Math.sqrt(rdx * rdx + rdy * rdy) + 0.01;

        // Centring pull (gentle).
        n.vx -= rdx * CENTER_PULL;
        n.vy -= rdy * CENTER_PULL;

        // Tangential orbit force — perpendicular to the radial vector.
        // (-rdy, rdx) is the +90° rotation of the radial direction.
        // Magnitude grows with radius up to ORBIT_FORCE_MAX_R, then plateaus.
        const orbitMag = ORBIT_FORCE * Math.min(r, ORBIT_FORCE_MAX_R);
        n.vx += (-rdy / r) * orbitMag;
        n.vy += (rdx / r) * orbitMag;

        n.vx *= DAMPING;
        n.vy *= DAMPING;

        // Velocity clamp — galaxies don't relativistic-jet.
        if (n.vx > MAX_VELOCITY) n.vx = MAX_VELOCITY;
        else if (n.vx < -MAX_VELOCITY) n.vx = -MAX_VELOCITY;
        if (n.vy > MAX_VELOCITY) n.vy = MAX_VELOCITY;
        else if (n.vy < -MAX_VELOCITY) n.vy = -MAX_VELOCITY;

        n.x += n.vx;
        n.y += n.vy;
      }

      // ─── Render ──────────────────────────────────────────────────────────
      ctx.clearRect(0, 0, w, h);

      const dark = isDarkBackground(container);

      // 1. Nebula — a faint radial glow from the centre. Sells the "deep
      //    space" feel without overwhelming the existing theme background.
      const nebula = ctx.createRadialGradient(
        cx,
        cy,
        0,
        cx,
        cy,
        Math.max(w, h) * 0.7
      );
      if (dark) {
        nebula.addColorStop(0, 'rgba(70, 50, 130, 0.18)');
        nebula.addColorStop(0.45, 'rgba(30, 40, 90, 0.08)');
        nebula.addColorStop(1, 'rgba(0, 0, 0, 0)');
      } else {
        nebula.addColorStop(0, 'rgba(150, 170, 220, 0.12)');
        nebula.addColorStop(0.5, 'rgba(180, 200, 230, 0.04)');
        nebula.addColorStop(1, 'rgba(255, 255, 255, 0)');
      }
      ctx.fillStyle = nebula;
      ctx.fillRect(0, 0, w, h);

      // 2. Background starfield — two parallax layers drifting in opposite
      //    directions. Each star twinkles independently via its own phase.
      const stars = bgStarsRef.current;
      if (stars) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const drawBgLayer = (
          layer: BgStar[],
          drift: number,
          baseAlpha: number,
          color: string
        ) => {
          for (const s of layer) {
            // Wrap horizontally so the layer scrolls forever.
            const xn = (s.x + tSec * drift) % 1;
            const x = xn * w;
            const y = s.y * h;
            const tw = 0.55 + 0.45 * Math.sin(tSec * 0.9 + s.phase);
            ctx.globalAlpha = s.brightness * tw * baseAlpha;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(x, y, s.size, 0, Math.PI * 2);
            ctx.fill();
          }
        };
        if (dark) {
          drawBgLayer(stars.far, BG_DRIFT_FAR, 0.32, '#a8b8ff');
          drawBgLayer(stars.near, BG_DRIFT_NEAR, 0.55, '#ffffff');
        } else {
          drawBgLayer(stars.far, BG_DRIFT_FAR, 0.18, '#7080b0');
          drawBgLayer(stars.near, BG_DRIFT_NEAR, 0.28, '#5060a0');
        }
        ctx.restore();
      }

      // 3. Edges — faint constellation lines.
      ctx.save();
      ctx.lineWidth = 1;
      ctx.strokeStyle = dark
        ? 'rgba(150, 170, 220, 0.18)'
        : 'rgba(80, 100, 150, 0.20)';
      for (const e of edges) {
        const a = nodeMap.get(e.source);
        const b = nodeMap.get(e.target);
        if (!a || !b) continue;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      ctx.restore();

      // 4. Nodes — each rendered as a halo + bright core, twinkling.
      const hoverId = hoverIdRef.current;
      const selId = selectedIdRef.current;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const n of nodes) {
        const isHover = n.id === hoverId;
        const isSelected = n.id === selId;
        // Twinkle: 0.65..1.0 alpha, 0.85..1.15 size, sinusoidal at ~0.7Hz.
        const tw = Math.sin(tSec * 0.7 + n.twinklePhase);
        const twAlpha = 0.825 + 0.175 * tw;
        const twSize = 1 + 0.15 * tw;

        const baseR = (isHover ? NODE_RADIUS_HOVER : NODE_RADIUS) * n.scale;
        const r = baseR * twSize;
        // Selected nodes get a slightly larger halo so they read as picked
        // even when not hovered. Hover stays warm-amber, selected stays
        // whatever cool/warm tint the node already has — the ring (drawn
        // below) is what announces selection unambiguously.
        const haloR = r * NODE_HALO_MULT * (isSelected ? 1.25 : 1);

        // Slight hue tint per node — some warmer, some cooler.
        const haloHue = Math.sin(n.hueShift); // -1..1
        let haloColor: string;
        if (isHover) {
          haloColor = dark ? 'rgba(255, 200, 110, 1)' : 'rgba(220, 130, 50, 1)';
        } else if (haloHue > 0) {
          // Warm — pale gold.
          haloColor = dark
            ? 'rgba(220, 200, 170, 1)'
            : 'rgba(180, 150, 110, 1)';
        } else {
          // Cool — pale blue-white.
          haloColor = dark
            ? 'rgba(170, 200, 240, 1)'
            : 'rgba(110, 140, 200, 1)';
        }

        // Halo (radial gradient → transparent). Parse the rgba once to
        // inject per-stop alpha.
        const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, haloR);
        const colorMatch = /rgba\((\d+),\s*(\d+),\s*(\d+),/.exec(haloColor);
        const hr = colorMatch ? +colorMatch[1] : 255;
        const hg = colorMatch ? +colorMatch[2] : 255;
        const hb = colorMatch ? +colorMatch[3] : 255;
        grad.addColorStop(0, `rgba(${hr}, ${hg}, ${hb}, ${0.55 * twAlpha})`);
        grad.addColorStop(0.4, `rgba(${hr}, ${hg}, ${hb}, ${0.22 * twAlpha})`);
        grad.addColorStop(1, `rgba(${hr}, ${hg}, ${hb}, 0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(n.x, n.y, haloR, 0, Math.PI * 2);
        ctx.fill();

        // Bright core.
        ctx.globalAlpha = twAlpha;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(n.x, n.y, r * 0.55, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;

        // Selection ring — drawn in normal compositing so it stays a crisp
        // 1px white outline (under 'lighter' it would saturate / wash out).
        if (isSelected) {
          ctx.save();
          ctx.globalCompositeOperation = 'source-over';
          ctx.lineWidth = 1;
          ctx.strokeStyle = dark
            ? 'rgba(255, 255, 255, 0.95)'
            : 'rgba(20, 20, 30, 0.85)';
          ctx.beginPath();
          ctx.arc(n.x, n.y, r * 1.4, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }
      ctx.restore();

      // 5. Hover label — drawn last so it sits above everything.
      if (hoverId) {
        const n = nodes.find(x => x.id === hoverId);
        if (n) {
          ctx.save();
          ctx.font =
            '12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
          ctx.shadowColor = dark
            ? 'rgba(0, 0, 0, 0.85)'
            : 'rgba(255, 255, 255, 0.85)';
          ctx.shadowBlur = 4;
          ctx.fillStyle = dark
            ? 'rgba(255, 255, 255, 0.95)'
            : 'rgba(20, 20, 30, 0.95)';
          ctx.fillText(n.title, n.x + 14, n.y + 4);
          ctx.restore();
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

  // Esc closes the preview panel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedId(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
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
      // Hit-test against the visible halo so it feels generous.
      const hitR = NODE_RADIUS_HOVER * n.scale * 1.6;
      if (dx * dx + dy * dy <= hitR * hitR) {
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
      if (!hit) {
        // Click on empty canvas — dismiss the preview panel.
        setSelectedId(null);
        return;
      }
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
      // Treat as a click if movement was tiny — open the preview panel for
      // the clicked node rather than navigating directly.
      if (drag) {
        const node = stateRef.current.nodes.find(n => n.id === drag.id);
        if (!node) return;
        const rect = canvas?.getBoundingClientRect();
        if (!rect) return;
        const dx = node.x - (e.clientX - rect.left + drag.offsetX);
        const dy = node.y - (e.clientY - rect.top + drag.offsetY);
        if (dx * dx + dy * dy < 9) {
          setSelectedId(drag.id);
        }
      }
    },
    []
  );

  const isEmpty = docTitlesById.size === 0 || edges.length === 0;

  // Preview-panel data. Title falls back to the reactive docTitlesById map so
  // a rename re-renders the panel even though the underlying nodes array is
  // a ref. Edge counts are computed off the reactive `edges` state.
  const selectedTitle = selectedId
    ? (docTitlesById.get(selectedId) ??
      stateRef.current.nodes.find(n => n.id === selectedId)?.title ??
      'Untitled')
    : '';

  // Memoized so the per-frame React re-renders triggered by the simulation's
  // hover/selection updates don't re-walk all 200+ edges every paint.
  const { outboundCount, inboundCount } = useMemo(() => {
    if (!selectedId) return { outboundCount: 0, inboundCount: 0 };
    let out = 0;
    let inb = 0;
    for (const e of edges) {
      if (e.source === selectedId) out++;
      else if (e.target === selectedId) inb++;
    }
    return { outboundCount: out, inboundCount: inb };
  }, [edges, selectedId]);

  const onOpenDoc = useCallback(() => {
    if (!selectedId) return;
    workbenchService.workbench.openDoc(selectedId);
  }, [selectedId, workbenchService]);
  const onOpenPeek = useCallback(() => {
    if (!selectedId) return;
    peekViewService.peekView
      .open({
        type: 'doc',
        docRef: { docId: selectedId },
      })
      .catch(console.error);
  }, [selectedId, peekViewService]);

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
      <div
        // `inert` (HTML global, supported across modern browsers) takes the
        // whole subtree out of the focus order, hides it from AT, and blocks
        // pointer events when set. This matters because the panel is always
        // mounted (so the slide-in animation can run) but invisible when
        // collapsed — without inert, its buttons stay tab-focusable behind
        // the offscreen translate, which is a real a11y trap.

        inert={selectedId ? undefined : ''}
        aria-hidden={selectedId ? undefined : true}
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: 320,
          background: 'rgba(20, 20, 30, 0.72)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
          padding: 20,
          boxSizing: 'border-box',
          color: 'rgba(255, 255, 255, 0.92)',
          display: 'flex',
          flexDirection: 'column',
          // Keep the panel mounted so the slide animation can run; just push
          // it offscreen + disable pointer events when nothing is selected.
          transform: selectedId ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 240ms ease',
          pointerEvents: selectedId ? 'auto' : 'none',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: '#fff',
              lineHeight: 1.3,
              wordBreak: 'break-word',
            }}
          >
            {selectedTitle}
          </div>
          <button
            type="button"
            aria-label="Close preview"
            onClick={() => setSelectedId(null)}
            style={{
              flex: '0 0 auto',
              width: 28,
              height: 28,
              borderRadius: 6,
              background: 'transparent',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.7)',
              fontSize: 18,
              lineHeight: 1,
              cursor: 'pointer',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ×
          </button>
        </div>
        <div
          style={{
            marginTop: 10,
            fontSize: 12,
            color: 'rgba(255, 255, 255, 0.55)',
          }}
        >
          {outboundCount === 0 && inboundCount === 0
            ? 'No links — orphan doc'
            : `${outboundCount} outbound · ${inboundCount} inbound`}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            type="button"
            onClick={onOpenDoc}
            style={{
              width: '100%',
              padding: '10px 14px',
              fontSize: 13,
              fontWeight: 600,
              color: '#0b0b14',
              background: 'rgba(255, 255, 255, 0.92)',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            Open document
          </button>
          <button
            type="button"
            onClick={onOpenPeek}
            style={{
              width: '100%',
              padding: '10px 14px',
              fontSize: 13,
              fontWeight: 500,
              color: 'rgba(255, 255, 255, 0.92)',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.14)',
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            Open in peek
          </button>
        </div>
      </div>
    </div>
  );
};
