import { style } from '@vanilla-extract/css';

// All vanilla-extract `style({...})` calls MUST live in `.css.ts` files
// per CLAUDE.md §6 — calling style({}) from .tsx compiles fine but
// throws at runtime and kills the React mount silently.

export const breadcrumbRoot = style({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 6,
  fontSize: 12,
  lineHeight: 1.4,
  color: 'var(--affine-text-secondary-color)',
  padding: '4px 0',
});

export const breadcrumbItem = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '2px 8px',
  borderRadius: 4,
  cursor: 'pointer',
  transition:
    'background-color var(--affine-anim-duration-base) var(--affine-anim-curve-default), color var(--affine-anim-duration-base) var(--affine-anim-curve-default)',
  selectors: {
    '&:hover': {
      backgroundColor: 'var(--affine-hover-color)',
      color: 'var(--affine-text-primary-color)',
    },
    '&[data-level="PROJECT"]': {
      fontWeight: 600,
    },
    '&[data-status="ACHIEVED"]': {
      color: 'var(--affine-text-tertiary-color)',
      textDecoration: 'line-through',
    },
    '&[data-status="CANCELLED"]': {
      color: 'var(--affine-text-tertiary-color)',
      opacity: 0.7,
    },
  },
});

export const breadcrumbBadge = style({
  display: 'inline-block',
  padding: '0 6px',
  borderRadius: 999,
  fontSize: 10,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: 0.4,
  color: 'var(--affine-brand-color)',
  background: 'var(--affine-tag-blue, rgba(28, 158, 228, 0.12))',
});

export const breadcrumbSeparator = style({
  color: 'var(--affine-text-tertiary-color)',
  fontWeight: 400,
  userSelect: 'none',
});

export const taskLabel = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '2px 8px',
  borderRadius: 4,
  background: 'var(--affine-hover-color, rgba(0, 0, 0, 0.04))',
});

export const currentTaskLabel = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '2px 8px',
  borderRadius: 4,
  color: 'var(--affine-text-primary-color)',
  fontWeight: 600,
});

export const emptyState = style({
  padding: '4px 8px',
  color: 'var(--affine-text-tertiary-color)',
  fontStyle: 'italic',
  fontSize: 12,
});
