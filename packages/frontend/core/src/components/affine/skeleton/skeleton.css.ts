/**
 * Manut M2 E2.7 — brand-themed skeleton loader styles.
 *
 * Same leaf-safety constraint as the floating chat panel
 * (./../../floating-ai-chat-anchor/styles.css.ts): no imports from the
 * `@affine/component` package root and no `animationToken` TS bindings.
 * Vanilla-extract evaluates this file in a Node VM at build time and
 * pulling DOM-touching siblings via the package root crashes the build
 * with `ReferenceError: HTMLElement is not defined` (CLAUDE.md §6).
 * Reference raw `--manut-*` and `--affine-*` CSS variables directly.
 *
 * Two animation modes:
 *   - `shimmer`  → diagonal violet-tinted gradient sweep (brand-accent).
 *     Use for surfaces the user is actively waiting on (doc list initial
 *     fetch, settings panels, AI history dropdown).
 *   - `pulse`   → ambient opacity breathe. Use for inline placeholders
 *     where shimmer would feel too loud (avatar dots, status pills).
 *
 * Both honour `prefers-reduced-motion: reduce` by stopping the
 * animation — the placeholder still renders, just without the moving
 * highlight, so layout is preserved.
 */
import { cssVar } from '@toeverything/theme';
import { keyframes, style } from '@vanilla-extract/css';

const shimmerKeyframes = keyframes({
  '0%': { backgroundPosition: '-200% 0' },
  '100%': { backgroundPosition: '200% 0' },
});

const pulseKeyframes = keyframes({
  '0%': { opacity: 0.5 },
  '50%': { opacity: 0.85 },
  '100%': { opacity: 0.5 },
});

/**
 * Base block. Inherits dimensions from inline style props (caller passes
 * width/height) so this stays layout-free.
 */
export const root = style({
  display: 'block',
  position: 'relative',
  overflow: 'hidden',
  // Default placeholder tone — leans on the upstream placeholder colour
  // for theme-aware neutral, then the shimmer layer adds the violet
  // highlight on top.
  backgroundColor: cssVar('placeholderColor'),
  // Pre-set the gradient ONCE on the base; the animation modifier
  // toggles the keyframe. Without this `background-size` the shimmer
  // would be invisible (CSS gradients default to `auto`).
  backgroundImage: `linear-gradient(
    90deg,
    transparent 0%,
    var(--manut-accent-violet-bg) 50%,
    transparent 100%
  )`,
  backgroundSize: '200% 100%',
  backgroundRepeat: 'no-repeat',
  backgroundPosition: '-200% 0',
  borderRadius: 'var(--manut-radius-input)',
});

export const shimmer = style({
  animation: `${shimmerKeyframes} 1.8s ease-in-out infinite`,
  '@media': {
    '(prefers-reduced-motion: reduce)': {
      animation: 'none',
    },
  },
});

export const pulse = style({
  animation: `${pulseKeyframes} 2s ease-in-out infinite`,
  '@media': {
    '(prefers-reduced-motion: reduce)': {
      animation: 'none',
    },
  },
});

/**
 * Variant: circular placeholder for avatars / icons.
 */
export const circle = style({
  borderRadius: '50%',
});

/**
 * Variant: text-line placeholder. Matches body line-height so a stack of
 * three lines reads as a credible paragraph stub.
 */
export const textLine = style({
  height: '0.85em',
  margin: '0.25em 0',
});

/**
 * Stacked group container — used by `SkeletonGroup` to lay out N text
 * lines with a vertical gap that mirrors the body line-height.
 */
export const group = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  width: '100%',
});
