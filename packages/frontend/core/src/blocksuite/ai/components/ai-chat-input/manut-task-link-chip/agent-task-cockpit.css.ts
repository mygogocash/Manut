import { style } from '@vanilla-extract/css';

export const cockpitRoot = style({
  display: 'grid',
  gap: 8,
  minWidth: 260,
  maxWidth: 360,
  padding: 10,
  border: '1px solid var(--affine-border-color)',
  borderRadius: 8,
  background: 'var(--affine-background-overlay-panel-color)',
  boxShadow: '0 8px 24px var(--affine-shadow-color, rgba(0,0,0,0.12))',
  color: 'var(--affine-text-primary-color)',
});

export const cockpitHeader = style({
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 8,
});

export const cockpitEyebrow = style({
  fontSize: 11,
  lineHeight: '14px',
  color: 'var(--affine-text-tertiary-color)',
  textTransform: 'uppercase',
  letterSpacing: 0,
});

export const cockpitTitle = style({
  marginTop: 2,
  fontSize: 13,
  lineHeight: '18px',
  fontWeight: 600,
  color: 'var(--affine-text-primary-color)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const cockpitStatus = style({
  flex: '0 0 auto',
  padding: '2px 6px',
  borderRadius: 6,
  background: 'var(--affine-hover-color)',
  color: 'var(--affine-text-secondary-color)',
  fontSize: 11,
  lineHeight: '16px',
  fontWeight: 500,
});

export const cockpitGrid = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 6,
});

export const cockpitMetric = style({
  display: 'grid',
  gap: 2,
  padding: '7px 8px',
  borderRadius: 6,
  background: 'var(--affine-background-secondary-color)',
  minWidth: 0,
});

export const metricLabel = style({
  fontSize: 11,
  lineHeight: '14px',
  color: 'var(--affine-text-tertiary-color)',
});

export const metricValue = style({
  fontSize: 12,
  lineHeight: '16px',
  fontWeight: 600,
  color: 'var(--affine-text-primary-color)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const cockpitActions = style({
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 6,
});

export const cockpitButton = style({
  minHeight: 28,
  padding: '0 8px',
  borderRadius: 6,
  border: '1px solid var(--affine-border-color)',
  background: 'transparent',
  color: 'var(--affine-text-primary-color)',
  fontSize: 12,
  lineHeight: '18px',
  cursor: 'pointer',
  selectors: {
    '&:hover': {
      background: 'var(--affine-hover-color)',
    },
  },
});
