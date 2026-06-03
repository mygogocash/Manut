import { style } from '@vanilla-extract/css';

// All vanilla-extract `style({})` calls live in `.css.ts` per CLAUDE.md
// §6 — calling style() from a `.tsx` compiles fine but throws at
// runtime and kills the React mount silently.

export const chipRoot = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '4px 10px',
  borderRadius: 999,
  border: '1px solid var(--affine-border-color)',
  background: 'var(--affine-background-secondary-color)',
  color: 'var(--affine-text-secondary-color)',
  cursor: 'pointer',
  fontSize: 12,
  lineHeight: 1.4,
  transition:
    'background-color var(--affine-anim-duration-base) var(--affine-anim-curve-default), color var(--affine-anim-duration-base) var(--affine-anim-curve-default)',
  selectors: {
    '&:hover': {
      backgroundColor: 'var(--affine-hover-color)',
      color: 'var(--affine-text-primary-color)',
    },
    '&[data-bound="true"]': {
      borderColor: 'var(--affine-brand-color)',
      color: 'var(--affine-brand-color)',
    },
  },
});

export const chipLabel = style({
  fontWeight: 500,
  maxWidth: 160,
  overflow: 'hidden',
  whiteSpace: 'nowrap',
  textOverflow: 'ellipsis',
});

export const chipClearButton = style({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 16,
  height: 16,
  padding: 0,
  border: 'none',
  background: 'transparent',
  color: 'inherit',
  borderRadius: 4,
  cursor: 'pointer',
  selectors: {
    '&:hover': {
      backgroundColor: 'var(--affine-hover-color)',
    },
  },
});

export const pickerRoot = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  maxHeight: 320,
  overflow: 'auto',
  padding: 8,
  minWidth: 240,
});

export const cockpitSlot = style({
  padding: 8,
  paddingBottom: 0,
});

export const pickerSearchInput = style({
  width: '100%',
  padding: '6px 8px',
  borderRadius: 4,
  border: '1px solid var(--affine-border-color)',
  background: 'var(--affine-white)',
  color: 'var(--affine-text-primary-color)',
  fontSize: 13,
  selectors: {
    '&:focus': {
      outline: 'none',
      borderColor: 'var(--affine-brand-color)',
    },
  },
});

export const pickerOption = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  padding: '6px 8px',
  borderRadius: 4,
  cursor: 'pointer',
  textAlign: 'left',
  border: 'none',
  background: 'transparent',
  color: 'var(--affine-text-primary-color)',
  selectors: {
    '&:hover': {
      backgroundColor: 'var(--affine-hover-color)',
    },
  },
});

export const pickerOptionTitle = style({
  fontSize: 13,
  fontWeight: 500,
});

export const pickerOptionMeta = style({
  fontSize: 11,
  color: 'var(--affine-text-tertiary-color)',
});

export const pickerEmpty = style({
  padding: '12px 8px',
  color: 'var(--affine-text-tertiary-color)',
  fontStyle: 'italic',
  fontSize: 12,
  textAlign: 'center',
});
