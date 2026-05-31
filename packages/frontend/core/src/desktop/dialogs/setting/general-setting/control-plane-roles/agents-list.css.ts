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
    '&:focus-visible': {
      outline: `2px solid ${cssVarV2.button.primary}`,
      outlineOffset: '-2px',
    },
  },
});

export const nameCell = style({
  fontWeight: 500,
});

export const monoCell = style({
  fontFamily:
    'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", monospace',
  fontSize: 11,
  color: cssVarV2.text.secondary,
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

export const statusActive = style({
  background: cssVarV2.layer.background.success,
  color: cssVarV2.status.success,
});

export const statusPaused = style({
  // No `cssVarV2.status.warning` accessor exists on the typed v2 theme;
  // address the underlying CSS var directly so the pill picks up theme
  // colour without breaking type-checking.
  background: 'var(--affine-v2-layer-background-warning, #fff5d6)',
  color: 'var(--affine-v2-status-warning, #b8740d)',
});

export const statusTerminated = style({
  background: cssVarV2.layer.background.secondary,
  color: cssVarV2.text.secondary,
});

export const errorBox = style({
  fontSize: 12,
  lineHeight: '18px',
  color: cssVarV2.status.error,
  padding: '8px 12px',
  borderRadius: 4,
  background: cssVarV2.layer.background.error,
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

// --- Create form -----------------------------------------------------------

export const formGrid = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  paddingTop: 8,
});

export const fieldRow = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
});

export const fieldLabel = style({
  fontSize: 12,
  lineHeight: '18px',
  color: cssVarV2.text.secondary,
  fontWeight: 500,
});

export const fieldHint = style({
  fontSize: 11,
  lineHeight: '16px',
  color: cssVarV2.text.secondary,
});

export const select = style({
  width: '100%',
  height: 32,
  border: `1px solid ${cssVarV2.layer.insideBorder.border}`,
  borderRadius: 6,
  padding: '0 8px',
  fontSize: 13,
  lineHeight: '18px',
  color: cssVarV2.text.primary,
  background: cssVarV2.layer.background.primary,
  selectors: {
    '&:focus': {
      outline: `1px solid ${cssVarV2.layer.insideBorder.blackBorder}`,
    },
  },
});

export const formActions = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: 8,
  paddingTop: 12,
});

export const formError = style({
  fontSize: 12,
  lineHeight: '18px',
  color: cssVarV2.status.error,
});
