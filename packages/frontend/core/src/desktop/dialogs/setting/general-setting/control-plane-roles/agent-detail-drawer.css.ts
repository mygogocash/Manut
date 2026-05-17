import { cssVarV2 } from '@toeverything/theme/v2';
import { style } from '@vanilla-extract/css';

export const root = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 20,
  padding: '8px 4px 12px',
});

export const headerBlock = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
});

export const headerTitle = style({
  fontSize: 16,
  lineHeight: '24px',
  fontWeight: 600,
  color: cssVarV2.text.primary,
});

export const headerMeta = style({
  fontSize: 11,
  lineHeight: '16px',
  color: cssVarV2.text.secondary,
  fontFamily:
    'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", monospace',
});

export const section = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
});

export const sectionTitle = style({
  fontSize: 12,
  lineHeight: '18px',
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: cssVarV2.text.secondary,
});

export const factGrid = style({
  display: 'grid',
  gridTemplateColumns: '120px 1fr',
  rowGap: 6,
  columnGap: 12,
  fontSize: 12,
  lineHeight: '18px',
});

export const factLabel = style({
  color: cssVarV2.text.secondary,
});

export const factValue = style({
  color: cssVarV2.text.primary,
  wordBreak: 'break-word',
});

export const factMono = style({
  fontFamily:
    'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", monospace',
  fontSize: 11,
});

export const actionRow = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
});

export const apiKeyList = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
});

export const apiKeyRow = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  padding: '8px 10px',
  border: `1px solid ${cssVarV2.layer.insideBorder.border}`,
  borderRadius: 6,
  fontSize: 12,
});

export const apiKeyRowRevoked = style({
  opacity: 0.5,
});

export const apiKeyTokenLabel = style({
  fontFamily:
    'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", monospace',
  color: cssVarV2.text.primary,
});

export const apiKeyMeta = style({
  fontSize: 11,
  color: cssVarV2.text.secondary,
});

export const mintedBanner = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  padding: '10px 12px',
  borderRadius: 6,
  border: `1px solid ${cssVarV2.status.success}`,
  background: cssVarV2.layer.background.success,
  fontSize: 12,
  lineHeight: '18px',
  color: cssVarV2.text.primary,
});

export const mintedTokenBox = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 8px',
  borderRadius: 4,
  background: cssVarV2.layer.background.primary,
  border: `1px solid ${cssVarV2.layer.insideBorder.border}`,
  fontFamily:
    'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", monospace',
  fontSize: 11,
  wordBreak: 'break-all',
});

export const emptyApiKeys = style({
  padding: '12px',
  border: `1px dashed ${cssVarV2.layer.insideBorder.border}`,
  borderRadius: 6,
  textAlign: 'center',
  color: cssVarV2.text.secondary,
  fontSize: 12,
});

export const errorBox = style({
  fontSize: 12,
  lineHeight: '18px',
  color: cssVarV2.status.error,
  padding: '8px 12px',
  borderRadius: 4,
  background: cssVarV2.layer.background.error,
});

export const heartbeatRow = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '6px 8px',
  borderRadius: 4,
  fontSize: 11,
  color: cssVarV2.text.secondary,
  fontFamily:
    'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", monospace',
  selectors: {
    '&:nth-child(odd)': {
      background: cssVarV2.layer.background.secondary,
    },
  },
});
