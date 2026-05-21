// Manut analytics Wave 2 / M3 E3.4 — MongoDB ingestion picker styles.
//
// vanilla-extract `style()` MUST live in `.css.ts` files. Calling
// it from a `.tsx` compiles fine but throws at runtime, killing React
// mount silently (CLAUDE.md §6).
import { cssVarV2 } from '@toeverything/theme/v2';
import { style } from '@vanilla-extract/css';

export const root = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  padding: '12px 0',
});

export const sectionHeader = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
});

export const title = style({
  fontSize: 13,
  fontWeight: 600,
  color: cssVarV2.text.primary,
});

export const subtitle = style({
  fontSize: 12,
  color: cssVarV2.text.secondary,
});

export const errorMessage = style({
  fontSize: 12,
  color: cssVarV2.status.error,
  padding: '8px 12px',
  borderRadius: 4,
  background: cssVarV2.layer.background.error,
});

export const emptyState = style({
  fontSize: 12,
  color: cssVarV2.text.secondary,
  padding: '16px 12px',
  borderRadius: 6,
  border: `1px dashed ${cssVarV2.layer.insideBorder.border}`,
  background: cssVarV2.layer.background.secondary,
  textAlign: 'center',
});

export const table = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 1,
  borderRadius: 8,
  overflow: 'hidden',
  border: `1px solid ${cssVarV2.layer.insideBorder.border}`,
  background: cssVarV2.layer.insideBorder.border,
});

export const row = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: '10px 12px',
  background: cssVarV2.layer.background.primary,
});

export const rowMain = style({
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  flexWrap: 'wrap',
});

export const collectionName = style({
  flex: '1 1 200px',
  fontFamily:
    'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", monospace',
  fontSize: 12,
  color: cssVarV2.text.primary,
});

export const countBadge = style({
  fontSize: 11,
  color: cssVarV2.text.secondary,
  background: cssVarV2.layer.background.secondary,
  padding: '2px 8px',
  borderRadius: 999,
  whiteSpace: 'nowrap',
});

export const lastSyncedBadge = style({
  fontSize: 11,
  color: cssVarV2.status.success,
  background: cssVarV2.layer.background.success,
  padding: '2px 8px',
  borderRadius: 999,
  whiteSpace: 'nowrap',
});

export const toggleLabel = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 12,
  color: cssVarV2.text.secondary,
  cursor: 'pointer',
});

export const cursorFieldInput = style({
  fontFamily:
    'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", monospace',
  fontSize: 11,
  padding: '4px 8px',
  width: 140,
  borderRadius: 4,
  border: `1px solid ${cssVarV2.layer.insideBorder.border}`,
  background: cssVarV2.layer.background.primary,
  color: cssVarV2.text.primary,
  selectors: {
    '&:focus-visible': {
      outline:
        '2px solid var(--manut-accent-violet, var(--affine-primary-color))',
      outlineOffset: 1,
    },
  },
});

export const sampleToggle = style({
  fontSize: 11,
  color: cssVarV2.text.secondary,
  background: 'transparent',
  border: 'none',
  padding: 0,
  cursor: 'pointer',
  textDecoration: 'underline',
  selectors: {
    '&:hover': {
      color: cssVarV2.text.primary,
    },
    '&[disabled]': {
      cursor: 'not-allowed',
      opacity: 0.5,
    },
  },
});

export const samplePanel = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  padding: 8,
  borderRadius: 6,
  background: cssVarV2.layer.background.secondary,
  maxHeight: 240,
  overflowY: 'auto',
});

export const sampleDoc = style({
  fontFamily:
    'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", monospace',
  fontSize: 11,
  color: cssVarV2.text.primary,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  padding: 6,
  background: cssVarV2.layer.background.primary,
  borderRadius: 4,
  border: `1px solid ${cssVarV2.layer.insideBorder.border}`,
});

export const footer = style({
  display: 'flex',
  gap: 8,
  alignItems: 'center',
  justifyContent: 'flex-end',
  flexWrap: 'wrap',
  paddingTop: 8,
});

export const saveStatus = style({
  fontSize: 11,
  color: cssVarV2.text.secondary,
});

export const linkButton = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  fontSize: 12,
  color: 'var(--manut-accent-violet, var(--affine-primary-color))',
  background: 'transparent',
  border: 'none',
  padding: 0,
  cursor: 'pointer',
  textDecoration: 'underline',
  selectors: {
    '&:hover': {
      filter: 'brightness(1.1)',
    },
  },
});

export const inlineConfigureRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 12,
  color: cssVarV2.text.secondary,
});
