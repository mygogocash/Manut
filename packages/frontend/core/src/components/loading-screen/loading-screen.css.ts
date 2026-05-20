/**
 * Manut animated loading screen — pure CSS keyframes, no JS motion lib.
 *
 * Wave 2 B12 / M3 E3.4 brand polish. We avoid framer-motion here on
 * purpose: this loading screen is shown BEFORE the React tree has mounted
 * in some entry-points, and we want zero runtime motion library cost.
 * Plain CSS animations driven off existing `--affine-anim-*` and
 * `--manut-*` tokens keep this independent from the parallel E2.7
 * framer-motion presets work and let `prefers-reduced-motion: reduce`
 * collapse to 0ms automatically (animation tokens are already gated;
 * see `manut-tokens.css`).
 *
 * Token routing: keep this file leaf-pure. We reference the CSS vars
 * by name instead of importing from `@affine/component` package root
 * (the vanilla-extract Node-VM scar from CLAUDE.md §6 — `HTMLElement`
 * leaks out of sibling exports and crashes the build).
 */

import { keyframes, style } from '@vanilla-extract/css';

/**
 * Wordmark fade-in. The container is opacity-0 at mount, animates to 1
 * over `--affine-anim-duration-slow`, then sits steady. We layer a
 * subtle letter-by-letter rise underneath via a second keyframe on the
 * inner glyph spans for a little brand life — nothing too clever.
 */
const fadeInScreen = keyframes({
  '0%': { opacity: 0 },
  '100%': { opacity: 1 },
});

const wordmarkRise = keyframes({
  '0%': {
    opacity: 0,
    transform: 'translateY(8px)',
    filter: 'blur(4px)',
  },
  '60%': {
    opacity: 1,
    filter: 'blur(0)',
  },
  '100%': {
    opacity: 1,
    transform: 'translateY(0)',
    filter: 'blur(0)',
  },
});

const subtitlePulse = keyframes({
  '0%, 100%': { opacity: 0.55 },
  '50%': { opacity: 0.85 },
});

export const root = style({
  position: 'fixed',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 'var(--manut-space-4)',
  // Warm-neutral surface backdrop; falls back to the upstream page bg
  // so this works pre-theme-hydration on cold boots.
  backgroundColor:
    'var(--manut-bg-surface, var(--affine-background-primary-color))',
  color: 'var(--affine-text-primary-color)',
  zIndex: 1000,
  animation:
    'var(--affine-anim-duration-slow) var(--affine-anim-curve-default) both',
  animationName: fadeInScreen,
  // Honour reduced-motion: the duration tokens already collapse to 0ms
  // under `prefers-reduced-motion: reduce` (animation.css), but we
  // belt-and-brace the wordmark + subtitle below as well.
});

export const wordmark = style({
  fontFamily:
    '"Source Serif 4", var(--manut-font-display, var(--affine-font-family))',
  fontSize: '64px',
  fontWeight: 600,
  letterSpacing: '-0.02em',
  lineHeight: 1,
  color: 'var(--manut-accent-violet-fg, var(--affine-text-primary-color))',
  margin: 0,
  display: 'flex',
  gap: '2px',
  animation:
    'var(--affine-anim-duration-slow) var(--affine-anim-curve-default) both',
  animationName: wordmarkRise,
  '@media': {
    '(prefers-reduced-motion: reduce)': {
      animation: 'none',
    },
  },
});

/**
 * Optional: per-glyph stagger. Cosmetic — letters drift up in sequence.
 * The wordmark's outer animation already covers the no-motion case.
 */
export const wordmarkGlyph = style({
  display: 'inline-block',
  animation:
    'var(--affine-anim-duration-slow) var(--affine-anim-curve-default) both',
  animationName: wordmarkRise,
  selectors: {
    '&:nth-child(1)': { animationDelay: '0ms' },
    '&:nth-child(2)': { animationDelay: 'var(--manut-anim-duration-stagger)' },
    '&:nth-child(3)': {
      animationDelay: 'calc(var(--manut-anim-duration-stagger) * 2)',
    },
    '&:nth-child(4)': {
      animationDelay: 'calc(var(--manut-anim-duration-stagger) * 3)',
    },
    '&:nth-child(5)': {
      animationDelay: 'calc(var(--manut-anim-duration-stagger) * 4)',
    },
  },
  '@media': {
    '(prefers-reduced-motion: reduce)': {
      animation: 'none',
    },
  },
});

export const subtitle = style({
  fontSize: '14px',
  fontWeight: 400,
  color: 'var(--affine-text-secondary-color)',
  margin: 0,
  letterSpacing: '0.02em',
  animation: '2s var(--affine-anim-curve-default) infinite',
  animationName: subtitlePulse,
  '@media': {
    '(prefers-reduced-motion: reduce)': {
      animation: 'none',
      opacity: 0.7,
    },
  },
});
