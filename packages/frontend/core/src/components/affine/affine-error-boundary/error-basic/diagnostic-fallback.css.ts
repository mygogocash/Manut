import { cssVarV2 } from '@toeverything/theme/v2';
import { style } from '@vanilla-extract/css';

export const layout = style({
  position: 'absolute',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  height: '100%',
  width: '100%',
  padding: '24px',
  boxSizing: 'border-box',
});

export const container = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch',
  width: '100%',
  maxWidth: '560px',
  gap: '16px',
});

export const title = style({
  fontSize: 24,
  lineHeight: '32px',
  fontWeight: 600,
  color: cssVarV2('text/primary'),
  margin: 0,
});

export const description = style({
  fontSize: 14,
  lineHeight: '22px',
  fontWeight: 400,
  color: cssVarV2('text/secondary'),
  margin: 0,
});

export const codeBlock = style({
  fontFamily:
    'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
  fontSize: 13,
  lineHeight: '20px',
  color: cssVarV2('text/primary'),
  backgroundColor: cssVarV2('layer/background/secondary'),
  border: `1px solid ${cssVarV2('layer/insideBorder/border')}`,
  borderRadius: 6,
  padding: '12px 14px',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  maxHeight: 200,
  overflowY: 'auto',
  margin: 0,
});

export const metaRow = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  fontSize: 12,
  lineHeight: '18px',
  color: cssVarV2('text/secondary'),
});

export const metaLine = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexWrap: 'wrap',
});

export const metaLabel = style({
  fontWeight: 600,
  color: cssVarV2('text/primary'),
});

export const traceId = style({
  fontFamily:
    'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
  fontSize: 12,
  color: cssVarV2('text/secondary'),
  cursor: 'pointer',
  userSelect: 'all',
  padding: '2px 6px',
  borderRadius: 4,
  border: `1px solid ${cssVarV2('layer/insideBorder/border')}`,
  backgroundColor: cssVarV2('layer/background/secondary'),
});

export const buttonRow = style({
  display: 'flex',
  flexDirection: 'row',
  gap: 12,
  marginTop: 8,
  flexWrap: 'wrap',
});

export const button = style({
  minWidth: 140,
});
