import { style } from '@vanilla-extract/css';

// All vanilla-extract `style({...})` calls MUST live in `.css.ts` files
// per CLAUDE.md §6 — calling style({}) from .tsx compiles fine but
// throws at runtime and kills the React mount silently. Style imports
// from `@affine/component` from inside a .css.ts must use the relative
// path or the raw CSS variable (vanilla-extract evaluates the file in a
// Node VM with no DOM).

export const panelRoot = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: '12px 0',
});

export const panelHeader = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  fontSize: 12,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: 0.4,
  color: 'var(--affine-text-secondary-color)',
});

export const panelCount = style({
  fontSize: 11,
  fontWeight: 500,
  color: 'var(--affine-text-tertiary-color)',
});

export const emptyState = style({
  padding: '12px 14px',
  borderRadius: 6,
  background: 'var(--affine-background-secondary-color, rgba(0, 0, 0, 0.03))',
  color: 'var(--affine-text-tertiary-color)',
  fontSize: 12,
  fontStyle: 'italic',
});

export const productList = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
});

export const productRow = style({
  display: 'grid',
  gridTemplateColumns: '24px 1fr auto',
  alignItems: 'center',
  gap: 10,
  padding: '8px 10px',
  borderRadius: 6,
  background: 'var(--affine-background-primary-color, transparent)',
  border: '1px solid var(--affine-border-color, rgba(0, 0, 0, 0.08))',
  transition:
    'background-color var(--affine-anim-duration-base) var(--affine-anim-curve-default), border-color var(--affine-anim-duration-base) var(--affine-anim-curve-default)',
  selectors: {
    '&:hover': {
      background: 'var(--affine-hover-color, rgba(0, 0, 0, 0.04))',
      borderColor: 'var(--affine-border-color-strong, rgba(0, 0, 0, 0.16))',
    },
  },
});

export const productIcon = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 24,
  height: 24,
  color: 'var(--affine-icon-color, var(--affine-text-secondary-color))',
  selectors: {
    // Per-kind tint so the row scans fast in a long list.
    '&[data-kind="DOC"]': { color: 'var(--affine-tag-blue,   #1c9ee4)' },
    '&[data-kind="FILE"]': { color: 'var(--affine-tag-orange, #e5a83d)' },
    '&[data-kind="URL"]': { color: 'var(--affine-tag-purple, #8a5cf6)' },
    '&[data-kind="PR"]': { color: 'var(--affine-tag-green,  #1fb878)' },
    '&[data-kind="DEPLOYMENT"]': { color: 'var(--affine-tag-pink,   #e15c8c)' },
    '&[data-kind="CSV"]': { color: 'var(--affine-tag-teal,   #2eb1a8)' },
    '&[data-kind="SCREENSHOT"]': { color: 'var(--affine-tag-yellow, #d2b73b)' },
  },
});

export const productBody = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  minWidth: 0,
});

export const productTitle = style({
  fontSize: 13,
  fontWeight: 500,
  color: 'var(--affine-text-primary-color)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const productMeta = style({
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 11,
  color: 'var(--affine-text-tertiary-color)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const productKindBadge = style({
  display: 'inline-block',
  padding: '0 6px',
  borderRadius: 999,
  fontSize: 10,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: 0.4,
  background: 'var(--affine-tag-gray, rgba(0, 0, 0, 0.06))',
});

export const productAction = style({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '4px 10px',
  borderRadius: 4,
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--affine-brand-color)',
  background: 'transparent',
  border: '1px solid transparent',
  cursor: 'pointer',
  transition:
    'background-color var(--affine-anim-duration-base) var(--affine-anim-curve-default), border-color var(--affine-anim-duration-base) var(--affine-anim-curve-default)',
  selectors: {
    '&:hover': {
      background: 'var(--affine-hover-color, rgba(0, 0, 0, 0.04))',
      borderColor: 'var(--affine-border-color, rgba(0, 0, 0, 0.12))',
    },
  },
});
