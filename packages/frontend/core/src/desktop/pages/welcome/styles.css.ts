import { manutColor, manutRadius, manutSpace } from '@affine/component/theme';
import { style } from '@vanilla-extract/css';

/**
 * Welcome / first-workspace page styles.
 *
 * Wave 2 B5 — first-time workspace creation. New users land here after
 * sign-up and are asked to name their workspace before being routed
 * into /workspace/{id}/all. Visual language follows the Manut warm-
 * neutral palette with a violet accent on the primary CTA.
 *
 * Lives under `.css.ts` and only imports from `@affine/component/theme`
 * (a leaf sub-path) — the package root would pull in DOM-typed
 * siblings and crash vanilla-extract's Node VM evaluation. See
 * CLAUDE.md §6 "vanilla-extract evaluates .css.ts files in a Node VM"
 * for the scar this guards against.
 */

export const root = style({
  minHeight: '100vh',
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: manutSpace(6),
  // Warm neutral surface — picks up the body background, no extra fill.
  color: 'var(--affine-text-primary-color)',
});

export const card = style({
  width: '100%',
  maxWidth: '420px',
  display: 'flex',
  flexDirection: 'column',
  gap: manutSpace(5),
  padding: manutSpace(7),
  backgroundColor: 'var(--affine-background-overlay-panel-color)',
  border: '1px solid var(--affine-border-color)',
  borderRadius: manutRadius.card,
  boxShadow: 'var(--affine-shadow-2)',
});

export const greeting = style({
  display: 'flex',
  flexDirection: 'column',
  gap: manutSpace(2),
});

export const headline = style({
  fontSize: '28px',
  lineHeight: 1.2,
  fontWeight: 700,
  margin: 0,
  letterSpacing: '-0.01em',
});

export const subCopy = style({
  fontSize: '14px',
  lineHeight: 1.5,
  color: 'var(--affine-text-secondary-color)',
  margin: 0,
});

export const form = style({
  display: 'flex',
  flexDirection: 'column',
  gap: manutSpace(4),
});

export const label = style({
  display: 'flex',
  flexDirection: 'column',
  gap: manutSpace(2),
  fontSize: '13px',
  fontWeight: 500,
  color: 'var(--affine-text-secondary-color)',
});

export const errorText = style({
  fontSize: '12px',
  lineHeight: 1.4,
  color: 'var(--affine-error-color)',
  margin: 0,
});

export const submitButton = style({
  alignSelf: 'stretch',
  // Violet accent on the primary CTA to match the Manut visual system.
  backgroundColor: manutColor.violet.fg,
  borderColor: manutColor.violet.fg,
  color: '#ffffff',
  selectors: {
    '&:hover:not([disabled])': {
      // Subtle darken on hover — keep the violet accent dominant.
      filter: 'brightness(0.95)',
    },
  },
});
