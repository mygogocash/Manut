/**
 * /manifesto — easter-egg brand page.
 *
 * Wave 2 B12 / M3 E3.4 brand polish. Standalone, public-readable page
 * with lush editorial typography (Source Serif 4 for display, Inter
 * for body — both already wired in fonts.css) and a subtle
 * scroll-driven gradient background.
 *
 * The gradient effect uses CSS scroll-linked `background-attachment:
 * fixed` + `linear-gradient` with viewport-tied stops so it shifts
 * gently as the reader scrolls. No JS — keeps this page tiny and
 * safe to ship as a marketing surface.
 *
 * Token routing: leaf-pure (no `@affine/component` package-root
 * imports). The vanilla-extract Node-VM scar (CLAUDE.md §6) bites
 * fast on display pages.
 */

import { keyframes, style } from '@vanilla-extract/css';

const slowDrift = keyframes({
  '0%': { backgroundPosition: '0% 0%' },
  '50%': { backgroundPosition: '100% 100%' },
  '100%': { backgroundPosition: '0% 0%' },
});

const fadeUp = keyframes({
  '0%': { opacity: 0, transform: 'translateY(16px)' },
  '100%': { opacity: 1, transform: 'translateY(0)' },
});

export const root = style({
  minHeight: '100vh',
  width: '100%',
  // Editorial gradient: violet + cream + magenta wash, anchored to
  // the viewport so it doesn't move with the document. The animation
  // gently drifts the gradient anchor — collapses under reduced
  // motion via the @media guard below.
  background:
    'linear-gradient(135deg, var(--manut-accent-violet-bg) 0%, var(--manut-accent-cream-bg) 50%, var(--manut-accent-magenta-bg) 100%)',
  backgroundSize: '200% 200%',
  backgroundAttachment: 'fixed',
  animation: '24s ease-in-out infinite',
  animationName: slowDrift,
  color: 'var(--affine-text-primary-color)',
  display: 'flex',
  justifyContent: 'center',
  padding: 'var(--manut-space-10) var(--manut-space-6)',
  '@media': {
    '(prefers-reduced-motion: reduce)': {
      animation: 'none',
      backgroundPosition: '50% 50%',
    },
  },
});

export const article = style({
  maxWidth: '640px',
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--manut-space-7)',
  animation:
    'var(--affine-anim-duration-slow) var(--affine-anim-curve-default) both',
  animationName: fadeUp,
  '@media': {
    '(prefers-reduced-motion: reduce)': {
      animation: 'none',
    },
  },
});

export const eyebrow = style({
  fontFamily: '"Space Mono", "IBM Plex Mono", monospace',
  fontSize: '12px',
  fontWeight: 400,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: 'var(--manut-accent-violet-fg)',
  margin: 0,
});

export const headline = style({
  fontFamily:
    '"Source Serif 4", var(--manut-font-display, var(--affine-font-family))',
  fontSize: 'clamp(48px, 8vw, 96px)',
  fontWeight: 600,
  fontStyle: 'italic',
  letterSpacing: '-0.03em',
  lineHeight: 1.02,
  margin: 0,
  color: 'var(--manut-accent-violet-fg, var(--affine-text-primary-color))',
});

export const body = style({
  fontFamily: 'Inter, var(--affine-font-family)',
  fontSize: '20px',
  lineHeight: 1.55,
  margin: 0,
  color: 'var(--affine-text-primary-color)',
});

export const verseList = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--manut-space-5)',
  margin: 0,
  padding: 0,
  listStyle: 'none',
});

export const verse = style({
  fontFamily:
    '"Source Serif 4", var(--manut-font-display, var(--affine-font-family))',
  fontSize: '24px',
  lineHeight: 1.4,
  fontWeight: 400,
  margin: 0,
  color: 'var(--affine-text-primary-color)',
  paddingLeft: 'var(--manut-space-4)',
  borderLeft: '2px solid var(--manut-accent-violet-border)',
});

export const signature = style({
  marginTop: 'var(--manut-space-7)',
  fontSize: '13px',
  letterSpacing: '0.05em',
  color: 'var(--affine-text-secondary-color)',
  fontFamily: '"Space Mono", "IBM Plex Mono", monospace',
});

export const homeLink = style({
  marginTop: 'var(--manut-space-5)',
  alignSelf: 'flex-start',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--manut-space-2)',
  padding: 'var(--manut-space-2) var(--manut-space-4)',
  borderRadius: 'var(--manut-radius-card)',
  border: '1px solid var(--manut-accent-violet-border)',
  backgroundColor: 'var(--manut-accent-violet-bg)',
  color: 'var(--manut-accent-violet-fg)',
  fontSize: '13px',
  fontWeight: 500,
  textDecoration: 'none',
  transition:
    'transform var(--affine-anim-duration-fast) var(--manut-anim-curve-overshoot), background-color var(--affine-anim-duration-fast) var(--affine-anim-curve-default)',
  selectors: {
    '&:hover': {
      transform: 'translateY(-1px)',
      backgroundColor: 'var(--manut-accent-violet-border)',
    },
    '&:focus-visible': {
      outline: '2px solid var(--manut-accent-violet-fg)',
      outlineOffset: 2,
    },
  },
});
