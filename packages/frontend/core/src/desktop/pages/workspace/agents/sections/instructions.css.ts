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

export const textarea = style({
  width: '100%',
  minHeight: 120,
  padding: '10px 12px',
  borderRadius: 8,
  border: `1px solid ${cssVarV2.layer.insideBorder.border}`,
  background: cssVarV2.layer.background.primary,
  color: cssVarV2.text.primary,
  fontSize: cssVar('fontSm'),
  fontFamily: 'inherit',
  lineHeight: 1.5,
  resize: 'vertical',
  outline: 'none',
  transition: 'border-color 120ms ease',
  selectors: {
    '&:focus': {
      borderColor: cssVarV2.layer.insideBorder.primaryBorder,
    },
    '&::placeholder': {
      color: cssVarV2.text.placeholder,
    },
  },
});
