/**
 * Manut-branded 404 — "This page wandered off."
 *
 * Wave 2 B12 / M3 E3.4 brand polish. Replaces the upstream
 * `<NotFoundPage>` for the catch-all route (`*`) AND `/404`.
 *
 * Token routing: this file is leaf-pure — we reference Manut CSS
 * vars by name rather than importing from `@affine/component`'s
 * package root, to dodge the vanilla-extract Node-VM scar that
 * surfaces when DOM-typed siblings leak into evaluation
 * (CLAUDE.md §6 "vanilla-extract evaluates `.css.ts` files in a
 * Node VM at build time").
 */

import { keyframes, style } from '@vanilla-extract/css';

const fadeUp = keyframes({
  '0%': { opacity: 0, transform: 'translateY(12px)' },
  '100%': { opacity: 1, transform: 'translateY(0)' },
});

const mascotFloat = keyframes({
  '0%, 100%': { transform: 'translateY(0) rotate(-2deg)' },
  '50%': { transform: 'translateY(-6px) rotate(2deg)' },
});

export const root = style({
  minHeight: '100vh',
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 'var(--manut-space-6)',
  padding: 'var(--manut-space-7)',
  backgroundColor:
    'var(--manut-bg-surface, var(--affine-background-primary-color))',
  color: 'var(--affine-text-primary-color)',
  textAlign: 'center',
});

export const card = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 'var(--manut-space-5)',
  maxWidth: '560px',
  animation:
    'var(--affine-anim-duration-slow) var(--affine-anim-curve-default) both',
  animationName: fadeUp,
  '@media': {
    '(prefers-reduced-motion: reduce)': {
      animation: 'none',
    },
  },
});

export const mascotWrapper = style({
  width: '120px',
  height: '120px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  animation: '6s ease-in-out infinite',
  animationName: mascotFloat,
  '@media': {
    '(prefers-reduced-motion: reduce)': {
      animation: 'none',
    },
  },
});

export const headline = style({
  fontFamily:
    '"Source Serif 4", var(--manut-font-display, var(--affine-font-family))',
  fontSize: '40px',
  fontWeight: 600,
  letterSpacing: '-0.02em',
  lineHeight: 1.1,
  margin: 0,
  // Headline uses the violet accent as the brand told us to.
  color: 'var(--manut-accent-violet-fg, var(--affine-text-primary-color))',
});

export const subCopy = style({
  fontSize: '16px',
  lineHeight: 1.55,
  color: 'var(--affine-text-secondary-color)',
  margin: 0,
  maxWidth: '440px',
});

export const actions = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: 'var(--manut-space-3)',
  justifyContent: 'center',
  marginTop: 'var(--manut-space-3)',
});

export const actionButton = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--manut-space-2)',
  padding: 'var(--manut-space-3) var(--manut-space-5)',
  borderRadius: 'var(--manut-radius-card)',
  border: '1px solid var(--affine-border-color)',
  backgroundColor: 'var(--affine-background-overlay-panel-color)',
  color: 'var(--affine-text-primary-color)',
  fontSize: '14px',
  fontWeight: 500,
  cursor: 'pointer',
  textDecoration: 'none',
  transition:
    'background-color var(--affine-anim-duration-fast) var(--affine-anim-curve-default), border-color var(--affine-anim-duration-fast) var(--affine-anim-curve-default), transform var(--affine-anim-duration-fast) var(--manut-anim-curve-overshoot)',
  selectors: {
    '&:hover:not([disabled])': {
      backgroundColor: 'var(--manut-accent-violet-bg)',
      borderColor: 'var(--manut-accent-violet-border)',
      color: 'var(--manut-accent-violet-fg)',
      transform: 'translateY(-1px)',
    },
    '&:focus-visible': {
      outline: '2px solid var(--manut-accent-violet-fg)',
      outlineOffset: 2,
    },
    '&[disabled]': {
      opacity: 0.5,
      cursor: 'not-allowed',
    },
  },
});

export const primaryAction = style({
  backgroundColor: 'var(--manut-accent-violet-fg)',
  borderColor: 'var(--manut-accent-violet-fg)',
  color: '#ffffff',
  selectors: {
    '&:hover:not([disabled])': {
      backgroundColor: 'var(--manut-accent-violet-fg)',
      borderColor: 'var(--manut-accent-violet-fg)',
      color: '#ffffff',
      filter: 'brightness(0.95)',
      transform: 'translateY(-1px)',
    },
  },
});

export const url = style({
  fontFamily: '"Space Mono", "IBM Plex Mono", monospace',
  fontSize: '12px',
  color: 'var(--affine-text-disable-color)',
  marginTop: 'var(--manut-space-4)',
  wordBreak: 'break-all',
  maxWidth: '560px',
});
