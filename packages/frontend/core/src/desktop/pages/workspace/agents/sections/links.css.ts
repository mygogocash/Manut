import { cssVar } from '@toeverything/theme';
import { cssVarV2 } from '@toeverything/theme/v2';
import { style } from '@vanilla-extract/css';

export const section = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
});

export const sectionHeader = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
});

export const sectionTitle = style({
  fontSize: cssVar('fontSm'),
  fontWeight: 600,
  color: cssVarV2.text.primary,
  margin: 0,
});

export const sectionIcon = style({
  fontSize: 16,
  color: cssVarV2.icon.primary,
  display: 'inline-flex',
  alignItems: 'center',
});

export const sectionDescription = style({
  fontSize: cssVar('fontXs'),
  color: cssVarV2.text.secondary,
  margin: 0,
  marginBottom: 4,
  lineHeight: 1.5,
});

export const list = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
});

export const item = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 10px',
  borderRadius: 6,
  border: `1px solid ${cssVarV2.layer.insideBorder.border}`,
  background: cssVarV2.layer.background.primary,
});

export const itemIcon = style({
  fontSize: 16,
  color: cssVarV2.icon.secondary,
  flexShrink: 0,
});

export const itemContent = style({
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  minWidth: 0,
  gap: 2,
});

export const itemLabel = style({
  fontSize: cssVar('fontSm'),
  color: cssVarV2.text.primary,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
});

export const itemUrl = style({
  fontSize: cssVar('fontXs'),
  color: cssVarV2.text.tertiary,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
});

export const addRow = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  padding: 10,
  borderRadius: 6,
  border: `1px dashed ${cssVarV2.layer.insideBorder.border}`,
  background: cssVarV2.layer.background.secondary,
});

export const addInputs = style({
  display: 'grid',
  gridTemplateColumns: '1fr 1fr auto',
  gap: 6,
});

export const addError = style({
  fontSize: cssVar('fontXs'),
  color: cssVarV2.status.error,
});
