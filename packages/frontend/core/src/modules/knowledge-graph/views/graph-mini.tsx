import { useEffect, useRef } from 'react';

import { getActivationBus } from '../services/activation-bus';
import { LOBE_PALETTE } from '../utils/graph-math';
import * as styles from './graph-mini.css';

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
export const GraphMini = (): React.ReactElement => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pulsesRef = useRef<MiniPulse[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Resolve CSS variables once at mount so we don't pay the
    // getComputedStyle cost every frame. The values are picked up from
    // the manut-tokens design-system layer; if the theme switches we'd
    // need to re-resolve, but theme switches are rare enough that a
    // mount-time read is fine for now.
    const root = document.documentElement;
    const computed = getComputedStyle(root);
    const accentBlue =
      computed.getPropertyValue('--manut-accent-blue-fg').trim() || '#1e96eb';

    // Backing store sized for devicePixelRatio so canvas drawing stays
    // crisp on retina displays. CSS width/height stays at 60x24 px;
    // the canvas's `width`/`height` attributes are scaled up so each
    // CSS pixel maps to dpr backing pixels.
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    const cssW = 60;
    const cssH = 24;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx.scale(dpr, dpr);

    // Static node positions — three dots laid out roughly evenly across
    // the 60px canvas with 12px margin on each side. Edges connect
    // 0->1 and 1->2 as faint cubic Beziers; pulses ride those edges.
    const nodes: ReadonlyArray<{ x: number; y: number }> = [
      { x: 12, y: 12 },
      { x: 30, y: 12 },
      { x: 48, y: 12 },
    ];
    const edges: ReadonlyArray<{ from: number; to: number; bow: number }> = [
      // `bow` is the perpendicular offset of the Bezier control points
      // away from the straight line — sign determines which side of
      // the line the curve bows toward. Alternating signs gives the
      // little double-arc the visual lift.
      { from: 0, to: 1, bow: -6 },
      { from: 1, to: 2, bow: 6 },
    ];

    // Subscribe to the same bus the full graph view uses. Every emit
    // queues one pulse on a random edge. Cap concurrent pulses so a
    // burst of doc-reads can't pile up indefinitely in this tiny
    // widget — the full graph absorbs them all, the mini surfaces a
    // sample.
    const PULSE_MAX = 6;

    const bus = getActivationBus();
    const subscription = bus.asObservable().subscribe(() => {
      const edgeIdx = Math.floor(Math.random() * edges.length);
      // Each pulse carries one of the lobe-palette hues so successive
      // pulses don't look identical. Index incremented per pulse via
      // length; never strays past palette boundary thanks to modulo.
      const lobeIdx = pulsesRef.current.length % LOBE_PALETTE.length;
      const palette = LOBE_PALETTE[lobeIdx];
      // `dark` swatches read well on the typical sidebar background —
      // light enough to glow, saturated enough to feel intentional.
      const rgb = palette.dark;
      const merged: MiniPulse[] = [
        ...pulsesRef.current,
        { edgeIdx, rgb, startedAt: performance.now() },
      ];
      // Drop oldest if we're past the cap so we never accumulate.
      pulsesRef.current =
        merged.length > PULSE_MAX
          ? merged.slice(merged.length - PULSE_MAX)
          : merged;
    });

    let raf = 0;
    const tick = () => {
      // Pause when tab is hidden — no point burning CPU when nobody
      // can see the pulses. The frame loop still schedules itself so
      // we resume immediately on tab focus.
      if (!document.hidden) {
        draw(ctx, cssW, cssH, nodes, edges, pulsesRef.current, accentBlue);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      subscription.unsubscribe();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={styles.canvas}
      aria-hidden="true"
      data-testid="knowledge-graph-mini"
    />
  );
};

/**
 * One in-flight synaptic pulse riding an edge. Lives for
 * PULSE_DURATION_MS, then is dropped on the next frame.
 */
interface MiniPulse {
  edgeIdx: number;
  rgb: readonly [number, number, number];
  startedAt: number;
}

/**
 * Pure draw routine — no rAF, no state. Clears the canvas, paints the
 * three background dots and two connector arcs, then paints any active
 * pulses on top with `lighter` compositing so overlapping glows
 * accumulate into a brighter flare.
 */
function draw(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  nodes: ReadonlyArray<{ x: number; y: number }>,
  edges: ReadonlyArray<{ from: number; to: number; bow: number }>,
  pulses: MiniPulse[],
  accentBlue: string
): void {
  // Clear in CSS-pixel space (we've already applied the DPR scale on
  // the context). `clearRect` honours the current transform.
  ctx.clearRect(0, 0, w, h);

  // Faint connector arcs — drawn first so dots + pulses overlay on top.
  ctx.save();
  ctx.strokeStyle = 'rgba(200, 200, 220, 0.28)';
  ctx.lineWidth = 1;
  for (const e of edges) {
    const src = nodes[e.from];
    const tgt = nodes[e.to];
    const { cp1x, cp1y, cp2x, cp2y } = controlPointsFor(src, tgt, e.bow);
    ctx.beginPath();
    ctx.moveTo(src.x, src.y);
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, tgt.x, tgt.y);
    ctx.stroke();
  }
  ctx.restore();

  // Background dots — small filled circles in the manut accent blue.
  // Sized at 2.5px radius for a crisp 5px diameter dot at 1x DPR.
  ctx.save();
  ctx.fillStyle = accentBlue;
  for (const n of nodes) {
    ctx.beginPath();
    ctx.arc(n.x, n.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Active pulses — bright dots racing along their edges. `lighter`
  // compositing makes overlapping pulse glows brighten rather than
  // occlude, which reads as a flare when two pulses cross paths.
  if (pulses.length === 0) return;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const nowMs = performance.now();
  const survivors: MiniPulse[] = [];
  const PULSE_DURATION_MS = 600;

  for (const p of pulses) {
    const t = (nowMs - p.startedAt) / PULSE_DURATION_MS;
    if (t >= 1) continue; // expired — don't carry forward
    survivors.push(p);

    const e = edges[p.edgeIdx];
    if (!e) continue;
    const src = nodes[e.from];
    const tgt = nodes[e.to];
    const { cp1x, cp1y, cp2x, cp2y } = controlPointsFor(src, tgt, e.bow);
    const { x, y } = bezierPoint(src, tgt, cp1x, cp1y, cp2x, cp2y, t);

    // Quadratic-out fade — bright at birth, soft at death.
    const alpha = (1 - t) * (1 - t);
    const [r, g, b] = p.rgb;

    // Trailing glow as a radial gradient, shrinks over the pulse life.
    const glowR = 4 + 2 * (1 - t);
    const glow = ctx.createRadialGradient(x, y, 0, x, y, glowR);
    glow.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${0.85 * alpha})`);
    glow.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${0.35 * alpha})`);
    glow.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, glowR, 0, Math.PI * 2);
    ctx.fill();

    // Bright white core dot — the spark itself.
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  // Mutate the array we were given so the next frame sees survivors.
  // This is the one spot where we intentionally mutate — `pulsesRef`
  // is a ref by design; rebuilding it every frame would force a
  // closure rebind. Trading purity for steady-state allocation cost.
  pulses.length = 0;
  for (const s of survivors) pulses.push(s);
}

/**
 * Cubic Bezier control points perpendicular to the source->target
 * line. `bow` is the perpendicular distance the curve bulges away
 * from the straight line; sign chooses which side. Centred around
 * 1/3 and 2/3 along the segment so the curve sits symmetrically.
 */
function controlPointsFor(
  src: { x: number; y: number },
  tgt: { x: number; y: number },
  bow: number
): { cp1x: number; cp1y: number; cp2x: number; cp2y: number } {
  const dx = tgt.x - src.x;
  const dy = tgt.y - src.y;
  const dist = Math.sqrt(dx * dx + dy * dy) + 0.01;
  // Perpendicular unit vector — rotate the segment 90° and normalise.
  const perpX = -dy / dist;
  const perpY = dx / dist;
  return {
    cp1x: src.x + dx * 0.33 + perpX * bow,
    cp1y: src.y + dy * 0.33 + perpY * bow,
    cp2x: src.x + dx * 0.66 + perpX * bow,
    cp2y: src.y + dy * 0.66 + perpY * bow,
  };
}

/**
 * Sample a cubic Bezier at parameter `t` ∈ [0, 1]. Standard polynomial
 * form. Inlined rather than calling a library for the sake of this
 * widget's tiny footprint.
 */
function bezierPoint(
  src: { x: number; y: number },
  tgt: { x: number; y: number },
  cp1x: number,
  cp1y: number,
  cp2x: number,
  cp2y: number,
  t: number
): { x: number; y: number } {
  const it = 1 - t;
  const it2 = it * it;
  const it3 = it2 * it;
  const t2 = t * t;
  const t3 = t2 * t;
  const x = it3 * src.x + 3 * it2 * t * cp1x + 3 * it * t2 * cp2x + t3 * tgt.x;
  const y = it3 * src.y + 3 * it2 * t * cp1y + 3 * it * t2 * cp2y + t3 * tgt.y;
  return { x, y };
}
