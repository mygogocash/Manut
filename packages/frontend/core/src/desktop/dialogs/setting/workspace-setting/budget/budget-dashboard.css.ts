import { style } from '@vanilla-extract/css';

/**
 * Budget dashboard styles (M4). vanilla-extract `style({})` MUST live in
 * `.css.ts` files — see CLAUDE.md §6 scar about the `style({})`-from-tsx
 * runtime crash. Tokens reference raw CSS variables to keep this file a
 * leaf module under vanilla-extract's Node-VM evaluator.
 */

export const wrapper = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
});

export const monthRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginBottom: 8,
});

export const monthLabel = style({
  color: 'var(--affine-text-secondary-color)',
  fontSize: 13,
});

export const monthInput = style({
  padding: '6px 10px',
  border: '1px solid var(--affine-border-color)',
  borderRadius: 6,
  background: 'var(--affine-background-primary-color)',
  fontFamily: 'inherit',
  fontSize: 13,
  color: 'var(--affine-text-primary-color)',
});

export const table = style({
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 13,
});

export const headerRow = style({
  textAlign: 'left',
  color: 'var(--affine-text-secondary-color)',
  fontWeight: 500,
  paddingBottom: 8,
  borderBottom: '1px solid var(--affine-border-color)',
});

export const cell = style({
  padding: '12px 8px',
  borderBottom: '1px solid var(--affine-divider-color)',
});

export const cellRight = style({
  padding: '12px 8px',
  borderBottom: '1px solid var(--affine-divider-color)',
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
});

export const utilizationBar = style({
  position: 'relative',
  height: 6,
  borderRadius: 3,
  background: 'var(--affine-hover-color)',
  overflow: 'hidden',
});

export const utilizationFill = style({
  position: 'absolute',
  top: 0,
  left: 0,
  height: '100%',
  borderRadius: 3,
  background: 'var(--affine-primary-color)',
  transition:
    'width var(--affine-anim-duration-base) var(--affine-anim-curve-default)',
});

export const utilizationFillWarn = style({
  background: 'var(--affine-warning-color)',
});

export const utilizationFillDanger = style({
  background: 'var(--affine-error-color)',
});

export const empty = style({
  padding: 24,
  textAlign: 'center',
  color: 'var(--affine-text-secondary-color)',
  fontSize: 13,
});

export const detailsList = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  marginTop: 16,
});

export const detailRow = style({
  display: 'flex',
  justifyContent: 'space-between',
  padding: '8px 0',
  borderBottom: '1px solid var(--affine-divider-color)',
  fontSize: 12,
  fontVariantNumeric: 'tabular-nums',
});

export const detailMeta = style({
  color: 'var(--affine-text-secondary-color)',
});
