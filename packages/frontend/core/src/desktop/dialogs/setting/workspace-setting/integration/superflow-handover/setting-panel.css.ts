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

export const textarea = style({
  width: '100%',
  minHeight: 176,
  resize: 'vertical',
  border: `1px solid ${cssVarV2.layer.insideBorder.border}`,
  borderRadius: 6,
  padding: '10px 12px',
  fontSize: 12,
  lineHeight: '18px',
  color: cssVarV2.text.primary,
  background: cssVarV2.layer.background.primary,
  fontFamily:
    'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", monospace',
  selectors: {
    '&:focus': {
      outline: `1px solid ${cssVarV2.layer.insideBorder.blackBorder}`,
    },
  },
});

export const actionRow = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
});

export const leftActions = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
});

export const fileInput = style({
  display: 'none',
});

export const preview = style({
  border: `1px solid ${cssVarV2.layer.insideBorder.border}`,
  borderRadius: 6,
  overflow: 'hidden',
});

export const previewGrid = style({
  display: 'grid',
  gridTemplateColumns: 'minmax(120px, 0.4fr) minmax(0, 1fr)',
});

export const previewLabel = style({
  padding: '8px 10px',
  borderBottom: `1px solid ${cssVarV2.layer.insideBorder.border}`,
  color: cssVarV2.text.secondary,
  fontSize: 12,
  lineHeight: '18px',
  background: cssVarV2.layer.background.secondary,
});

export const previewValue = style({
  minWidth: 0,
  padding: '8px 10px',
  borderBottom: `1px solid ${cssVarV2.layer.insideBorder.border}`,
  color: cssVarV2.text.primary,
  fontSize: 12,
  lineHeight: '18px',
  wordBreak: 'break-word',
});

export const gates = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  margin: 0,
  padding: '8px 10px 8px 24px',
  color: cssVarV2.text.primary,
  fontSize: 12,
  lineHeight: '18px',
});

export const muted = style({
  color: cssVarV2.text.secondary,
  fontSize: 12,
  lineHeight: '18px',
});

export const errorMessage = style({
  fontSize: 12,
  lineHeight: '18px',
  color: cssVarV2.status.error,
  padding: '8px 12px',
  borderRadius: 4,
  background: cssVarV2.layer.background.error,
});

export const successMessage = style({
  flex: 1,
  fontSize: 12,
  lineHeight: '18px',
  color: cssVarV2.text.primary,
  padding: '8px 12px',
  borderRadius: 4,
  background: cssVarV2.layer.background.secondary,
  border: `0.5px solid ${cssVarV2.layer.insideBorder.border}`,
});

export const successRow = style({
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 8,
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
