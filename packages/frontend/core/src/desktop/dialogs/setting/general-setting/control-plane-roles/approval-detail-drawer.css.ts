import { cssVarV2 } from '@toeverything/theme/v2';
import { style } from '@vanilla-extract/css';

export const drawer = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  padding: 16,
  minWidth: 480,
  maxWidth: 720,
});

export const sectionTitle = style({
  fontSize: 11,
  lineHeight: '16px',
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: cssVarV2.text.secondary,
  marginBottom: 6,
});

export const headerRow = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
});

export const meta = style({
  fontSize: 12,
  lineHeight: '18px',
  color: cssVarV2.text.secondary,
});

export const monoBlock = style({
  fontFamily:
    'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", monospace',
  fontSize: 11,
  lineHeight: '16px',
  color: cssVarV2.text.primary,
  background: cssVarV2.layer.background.secondary,
  border: `1px solid ${cssVarV2.layer.insideBorder.border}`,
  borderRadius: 4,
  padding: '8px 10px',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  maxHeight: 240,
  overflow: 'auto',
});

export const actionsRow = style({
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
});

export const commentList = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
});

export const commentRow = style({
  border: `1px solid ${cssVarV2.layer.insideBorder.border}`,
  borderRadius: 4,
  padding: '8px 10px',
});

export const commentMeta = style({
  fontSize: 11,
  lineHeight: '14px',
  color: cssVarV2.text.secondary,
  marginBottom: 4,
});

export const commentBody = style({
  fontSize: 12,
  lineHeight: '18px',
  color: cssVarV2.text.primary,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
});

export const commentForm = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
});

export const textArea = style({
  width: '100%',
  minHeight: 64,
  padding: '8px 10px',
  borderRadius: 4,
  border: `1px solid ${cssVarV2.layer.insideBorder.border}`,
  background: cssVarV2.layer.background.primary,
  color: cssVarV2.text.primary,
  fontSize: 12,
  lineHeight: '18px',
  resize: 'vertical',
  selectors: {
    '&:focus': {
      outline: `1px solid ${cssVarV2.layer.insideBorder.blackBorder}`,
    },
  },
});

export const errorBox = style({
  fontSize: 12,
  lineHeight: '18px',
  color: cssVarV2.status.error,
  padding: '6px 10px',
  borderRadius: 4,
  background: cssVarV2.layer.background.error,
});
