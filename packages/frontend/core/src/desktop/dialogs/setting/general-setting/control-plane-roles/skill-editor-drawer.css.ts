import { cssVarV2 } from '@toeverything/theme/v2';
import { style } from '@vanilla-extract/css';

export const root = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  padding: '8px 4px 12px',
});

export const headerBlock = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
});

export const headerMeta = style({
  fontSize: 11,
  lineHeight: '16px',
  color: cssVarV2.text.secondary,
  fontFamily:
    'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", monospace',
});

export const formGrid = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
});

export const fieldRow = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
});

export const fieldRowInline = style({
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 12,
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

// Markdown body editor — plain textarea with monospace styling per the brief.
// vanilla-extract evaluates this in a Node VM at build time so the textarea
// element doesn't render here; we just style it.
export const bodyEditor = style({
  width: '100%',
  minHeight: 320,
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
  tabSize: 2,
  selectors: {
    '&:focus': {
      outline: `1px solid ${cssVarV2.layer.insideBorder.blackBorder}`,
    },
  },
});

export const formActions = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  paddingTop: 12,
  borderTop: `1px solid ${cssVarV2.layer.insideBorder.border}`,
});

export const formActionsLeft = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
});

export const formActionsRight = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
});

export const formError = style({
  fontSize: 12,
  lineHeight: '18px',
  color: cssVarV2.status.error,
});

export const archivedBanner = style({
  padding: '8px 12px',
  borderRadius: 6,
  border: `1px solid ${cssVarV2.layer.insideBorder.border}`,
  background: cssVarV2.layer.background.secondary,
  color: cssVarV2.text.secondary,
  fontSize: 12,
  lineHeight: '18px',
});

// --- Export workspace modal -------------------------------------------------

export const exportResultRoot = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  padding: '8px 4px 4px',
});

export const exportResultFacts = style({
  display: 'grid',
  gridTemplateColumns: '110px 1fr',
  rowGap: 6,
  columnGap: 12,
  fontSize: 12,
  lineHeight: '18px',
});

export const exportResultLabel = style({
  color: cssVarV2.text.secondary,
});

export const exportResultValue = style({
  color: cssVarV2.text.primary,
  wordBreak: 'break-all',
});

export const exportResultMono = style({
  fontFamily:
    'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", monospace',
  fontSize: 11,
});

export const exportResultActions = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: 8,
  paddingTop: 8,
});
