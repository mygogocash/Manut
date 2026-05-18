import { cssVarV2 } from '@toeverything/theme/v2';
import { style } from '@vanilla-extract/css';

export const root = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
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

export const pluginName = style({
  fontWeight: 500,
  fontSize: 13,
});

export const slugCell = style({
  fontFamily:
    'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", monospace',
  fontSize: 11,
  color: cssVarV2.text.secondary,
});

export const lastSeenCell = style({
  fontSize: 11,
  color: cssVarV2.text.secondary,
});

export const toggleCell = style({
  textAlign: 'right',
  verticalAlign: 'middle',
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

export const capList = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: 4,
});

export const capPill = style({
  display: 'inline-flex',
  alignItems: 'center',
  padding: '2px 6px',
  borderRadius: 4,
  fontSize: 11,
  lineHeight: '14px',
  background: cssVarV2.layer.background.secondary,
  color: cssVarV2.text.secondary,
  fontFamily:
    'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", monospace',
});

export const statusPill = style({
  display: 'inline-flex',
  alignItems: 'center',
  padding: '2px 8px',
  borderRadius: 999,
  fontSize: 11,
  lineHeight: '16px',
  fontWeight: 500,
  textTransform: 'capitalize',
});

export const statusRunning = style({
  background: cssVarV2.layer.background.success,
  color: cssVarV2.status.success,
});

export const statusCrashed = style({
  background: cssVarV2.layer.background.error,
  color: cssVarV2.status.error,
});

export const statusOther = style({
  background: cssVarV2.layer.background.secondary,
  color: cssVarV2.text.secondary,
});
