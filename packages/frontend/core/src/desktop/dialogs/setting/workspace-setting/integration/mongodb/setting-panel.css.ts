import { cssVarV2 } from '@toeverything/theme/v2';
import { style } from '@vanilla-extract/css';

// MANUT Wave 7+: scoped styles for the MongoDB integration card.
// Vanilla-extract `style()` MUST live in `.css.ts` files
// (CLAUDE.md §6 — a `.css.ts` call from a `.tsx` file silently breaks
// React mount).
export const root = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  padding: '8px 0',
});

export const stateLabel = style({
  fontSize: 13,
  color: cssVarV2.text.primary,
});

export const errorMessage = style({
  fontSize: 12,
  color: cssVarV2.status.error,
  padding: '8px 12px',
  borderRadius: 4,
  background: cssVarV2.layer.background.error,
});

export const form = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  padding: 12,
  borderRadius: 'var(--manut-radius-card, 8px)',
  border: `1px solid ${cssVarV2.layer.insideBorder.border}`,
  background: cssVarV2.layer.background.secondary,
});

export const label = style({
  fontSize: 12,
  color: cssVarV2.text.secondary,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
});

export const input = style({
  fontFamily:
    'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", monospace',
  fontSize: 12,
  padding: '8px 10px',
  borderRadius: 6,
  border: `1px solid ${cssVarV2.layer.insideBorder.border}`,
  background: cssVarV2.layer.background.primary,
  color: cssVarV2.text.primary,
  selectors: {
    '&:focus-visible': {
      outline:
        '2px solid var(--manut-accent-violet, var(--affine-primary-color))',
      outlineOffset: 1,
    },
  },
});

export const actionsRow = style({
  display: 'flex',
  gap: 8,
  alignItems: 'center',
  flexWrap: 'wrap',
});

// Native submit button styled to match the AFFiNE primary Button —
// see setting-panel.tsx for why we don't use the Button component.
export const submitButton = style({
  display: 'inline-flex',
  alignItems: 'center',
  height: 28,
  padding: '0 14px',
  borderRadius: 6,
  border: 'none',
  background: 'var(--manut-accent-violet, var(--affine-primary-color))',
  color: '#fff',
  fontSize: 12,
  fontWeight: 500,
  cursor: 'pointer',
  transition:
    'filter var(--affine-anim-duration-base) var(--affine-anim-curve-default)',
  selectors: {
    '&:hover:not([disabled])': {
      filter: 'brightness(1.08)',
    },
    '&[disabled]': {
      opacity: 0.5,
      cursor: 'not-allowed',
    },
  },
});

export const successText = style({
  fontSize: 12,
  color: cssVarV2.status.success,
});

export const helpText = style({
  fontSize: 11,
  color: cssVarV2.text.secondary,
  lineHeight: 1.5,
});
