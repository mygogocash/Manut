import { cssVarV2 } from '@toeverything/theme/v2';
import { style } from '@vanilla-extract/css';

export const root = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  padding: '8px 0',
});

export const section = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
});

export const sectionTitle = style({
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

export const slugCell = style({
  fontFamily:
    'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", monospace',
  fontSize: 11,
  color: cssVarV2.text.secondary,
});

export const adapterCell = style({
  fontFamily:
    'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", monospace',
  fontSize: 11,
});

export const actionsCell = style({
  textAlign: 'right',
  whiteSpace: 'nowrap',
});

export const link = style({
  color: cssVarV2.text.link,
  textDecoration: 'none',
  selectors: {
    '&:hover': {
      textDecoration: 'underline',
    },
  },
});

export const errorBox = style({
  fontSize: 12,
  lineHeight: '18px',
  color: cssVarV2.status.error,
  padding: '8px 12px',
  borderRadius: 4,
  background: cssVarV2.layer.background.error,
});

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

export const slugInputDisabled = style({
  width: '100%',
  height: 32,
  border: `1px solid ${cssVarV2.layer.insideBorder.border}`,
  borderRadius: 6,
  padding: '0 8px',
  fontSize: 13,
  lineHeight: '18px',
  color: cssVarV2.text.secondary,
  background: cssVarV2.layer.background.secondary,
  cursor: 'not-allowed',
  fontFamily:
    'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", monospace',
});

export const textarea = style({
  width: '100%',
  minHeight: 70,
  resize: 'vertical',
  border: `1px solid ${cssVarV2.layer.insideBorder.border}`,
  borderRadius: 6,
  padding: '8px 10px',
  fontSize: 13,
  lineHeight: '18px',
  color: cssVarV2.text.primary,
  background: cssVarV2.layer.background.primary,
  fontFamily: 'inherit',
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

export const lastSeenCell = style({
  fontSize: 11,
  color: cssVarV2.text.secondary,
});

export const icon = style({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 24,
  height: 24,
  borderRadius: 5,
  background: cssVarV2.layer.background.secondary,
  color: cssVarV2.text.primary,
  fontSize: 11,
  lineHeight: '16px',
  fontWeight: 600,
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
