import {
  manutColor,
  manutRadius,
  manutSpace,
} from '@affine/component/theme/tokens';
import { style } from '@vanilla-extract/css';

/**
 * Manut Pro upgrade page styles (E3.3 / M3 — decision #19).
 *
 * Marketing page rendered at `/upgrade`. Headline pulls users into the
 * Stripe checkout via `createManutProCheckoutSession`. Surface follows
 * the Manut warm-neutral / violet-accent visual language used by the
 * `/welcome` wizard so the upgrade flow feels native.
 *
 * Lives under `.css.ts` and only imports from `@affine/component/theme/tokens`
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
  color: 'var(--affine-text-primary-color)',
});

export const card = style({
  width: '100%',
  maxWidth: '760px',
  display: 'flex',
  flexDirection: 'column',
  gap: manutSpace(6),
  padding: manutSpace(8),
  backgroundColor: 'var(--affine-background-overlay-panel-color)',
  border: '1px solid var(--affine-border-color)',
  borderRadius: manutRadius.card,
  boxShadow: 'var(--affine-shadow-2)',
});

export const header = style({
  display: 'flex',
  flexDirection: 'column',
  gap: manutSpace(3),
});

export const eyebrow = style({
  fontSize: '12px',
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: manutColor.violet.fg,
  margin: 0,
});

export const headline = style({
  fontSize: '36px',
  lineHeight: 1.15,
  fontWeight: 700,
  margin: 0,
  letterSpacing: '-0.015em',
});

export const subCopy = style({
  fontSize: '15px',
  lineHeight: 1.55,
  color: 'var(--affine-text-secondary-color)',
  margin: 0,
});

export const priceBlock = style({
  display: 'flex',
  alignItems: 'baseline',
  gap: manutSpace(2),
});

export const price = style({
  fontSize: '40px',
  fontWeight: 700,
  letterSpacing: '-0.02em',
});

export const priceUnit = style({
  fontSize: '14px',
  fontWeight: 500,
  color: 'var(--affine-text-secondary-color)',
});

export const compareTable = style({
  width: '100%',
  borderCollapse: 'collapse',
  border: '1px solid var(--affine-border-color)',
  borderRadius: manutRadius.input,
  overflow: 'hidden',
});

export const compareRow = style({
  display: 'grid',
  gridTemplateColumns: '2fr 1fr 1fr',
  alignItems: 'center',
});

export const compareHeader = style({
  fontWeight: 600,
  fontSize: '13px',
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: 'var(--affine-text-secondary-color)',
  backgroundColor: 'var(--affine-hover-color)',
});

export const compareCell = style({
  padding: `${manutSpace(3)} ${manutSpace(4)}`,
  fontSize: '14px',
  borderBottom: '1px solid var(--affine-border-color)',
  selectors: {
    '&:not(:first-child)': {
      borderLeft: '1px solid var(--affine-border-color)',
    },
  },
});

export const compareCellHighlight = style({
  fontWeight: 600,
  color: manutColor.violet.fg,
});

export const ctaRow = style({
  display: 'flex',
  flexDirection: 'column',
  gap: manutSpace(3),
});

export const upgradeButton = style({
  alignSelf: 'stretch',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: manutSpace(2),
  padding: `${manutSpace(3)} ${manutSpace(5)}`,
  fontSize: '15px',
  fontWeight: 600,
  borderRadius: manutRadius.input,
  border: `1px solid ${manutColor.violet.fg}`,
  backgroundColor: manutColor.violet.fg,
  color: '#ffffff',
  cursor: 'pointer',
  transition: 'filter 120ms ease, opacity 120ms ease',
  selectors: {
    '&:hover:not([disabled])': {
      filter: 'brightness(0.95)',
    },
    '&:disabled': {
      opacity: 0.55,
      cursor: 'not-allowed',
    },
  },
});

export const footnote = style({
  fontSize: '13px',
  color: 'var(--affine-text-secondary-color)',
  textAlign: 'center',
  margin: 0,
});

export const errorText = style({
  fontSize: '13px',
  color: 'var(--affine-error-color)',
  margin: 0,
  padding: manutSpace(3),
  border: '1px solid var(--affine-error-color)',
  borderRadius: manutRadius.input,
  backgroundColor: 'rgba(229, 73, 64, 0.06)',
});

export const backLink = style({
  alignSelf: 'flex-start',
  fontSize: '13px',
  color: 'var(--affine-text-secondary-color)',
  textDecoration: 'none',
  cursor: 'pointer',
  background: 'transparent',
  border: 'none',
  padding: 0,
  selectors: {
    '&:hover': {
      color: 'var(--affine-text-primary-color)',
      textDecoration: 'underline',
    },
  },
});
