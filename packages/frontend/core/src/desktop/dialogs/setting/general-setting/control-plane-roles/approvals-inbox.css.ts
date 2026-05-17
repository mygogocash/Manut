import { cssVarV2 } from '@toeverything/theme/v2';
import { style } from '@vanilla-extract/css';

export const root = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
});

export const headerRow = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
});

export const title = style({
  fontSize: 13,
  lineHeight: '20px',
  fontWeight: 500,
  color: cssVarV2.text.primary,
});

export const muted = style({
  color: cssVarV2.text.secondary,
  fontSize: 12,
  lineHeight: '18px',
});

export const filterBar = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexWrap: 'wrap',
});

export const tableWrapper = style({
  border: `1px solid ${cssVarV2.layer.insideBorder.border}`,
  borderRadius: 6,
  overflow: 'hidden',
});

export const table = style({
  width: '100%',
  borderCollapse: 'collapse',
  tableLayout: 'fixed',
});

export const th = style({
  textAlign: 'left',
  padding: '8px 10px',
  fontSize: 11,
  lineHeight: '16px',
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: cssVarV2.text.secondary,
  background: cssVarV2.layer.background.secondary,
  borderBottom: `1px solid ${cssVarV2.layer.insideBorder.border}`,
});

export const td = style({
  padding: '10px',
  fontSize: 12,
  lineHeight: '18px',
  color: cssVarV2.text.primary,
  borderBottom: `1px solid ${cssVarV2.layer.insideBorder.border}`,
  verticalAlign: 'top',
  wordBreak: 'break-word',
});

export const lastRowTd = style({
  borderBottom: 'none',
});

export const row = style({
  cursor: 'pointer',
  selectors: {
    '&:hover': {
      background: cssVarV2.layer.background.hoverOverlay,
    },
  },
});

export const statusPill = style({
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: 999,
  fontSize: 11,
  lineHeight: '16px',
  fontWeight: 500,
  textTransform: 'capitalize',
});

export const statusPending = style({
  background:
    'var(--affine-v2-layer-background-warning, color-mix(in oklab, currentColor 8%, transparent))',
  color: 'var(--affine-v2-status-warning, #b8740d)',
});

export const statusApproved = style({
  background: cssVarV2.layer.background.success,
  color: cssVarV2.status.success,
});

export const statusRejected = style({
  background: cssVarV2.layer.background.error,
  color: cssVarV2.status.error,
});

export const statusCancelled = style({
  background: cssVarV2.layer.background.secondary,
  color: cssVarV2.text.secondary,
});

export const statusRevision = style({
  background:
    'var(--affine-v2-layer-background-tertiary, color-mix(in oklab, currentColor 5%, transparent))',
  color: cssVarV2.text.primary,
});

export const typePill = style({
  display: 'inline-block',
  padding: '2px 6px',
  borderRadius: 4,
  fontSize: 10,
  lineHeight: '14px',
  fontWeight: 500,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  background: cssVarV2.layer.background.secondary,
  color: cssVarV2.text.secondary,
});

export const monoCell = style({
  fontFamily:
    'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", monospace',
  fontSize: 11,
  color: cssVarV2.text.secondary,
});

export const emptyState = style({
  padding: '24px 12px',
  border: `1px dashed ${cssVarV2.layer.insideBorder.border}`,
  borderRadius: 6,
  textAlign: 'center',
  color: cssVarV2.text.secondary,
  fontSize: 12,
  lineHeight: '18px',
});

export const errorBox = style({
  fontSize: 12,
  lineHeight: '18px',
  color: cssVarV2.status.error,
  padding: '8px 12px',
  borderRadius: 4,
  background: cssVarV2.layer.background.error,
});

export const skeletonRow = style({
  height: 40,
  borderRadius: 4,
  background: cssVarV2.layer.background.secondary,
  opacity: 0.6,
});

export const skeletonGroup = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
});
