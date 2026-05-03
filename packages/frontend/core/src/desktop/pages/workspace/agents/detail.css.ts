import { cssVar } from '@toeverything/theme';
import { cssVarV2 } from '@toeverything/theme/v2';
import { style } from '@vanilla-extract/css';

export const root = style({
  width: '100%',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  background: cssVarV2.layer.background.primary,
  overflow: 'hidden',
});

export const scroll = style({
  flex: 1,
  overflow: 'auto',
  padding: '24px 32px 64px 32px',
});

export const inner = style({
  width: '100%',
  maxWidth: 880,
  marginLeft: 'auto',
  marginRight: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 24,
});

export const header = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  paddingBottom: 16,
  borderBottom: `1px solid ${cssVarV2.layer.insideBorder.border}`,
});

export const nameInput = style({
  width: '100%',
  fontSize: 24,
  fontWeight: 600,
  color: cssVarV2.text.primary,
  background: 'transparent',
  border: 'none',
  outline: 'none',
  padding: '4px 0',
  fontFamily: 'inherit',
  borderBottom: '1px solid transparent',
  selectors: {
    '&:focus': {
      borderBottomColor: cssVarV2.layer.insideBorder.primaryBorder,
    },
    '&::placeholder': {
      color: cssVarV2.text.placeholder,
    },
  },
});

export const descriptionInput = style({
  width: '100%',
  fontSize: cssVar('fontSm'),
  color: cssVarV2.text.secondary,
  background: 'transparent',
  border: 'none',
  outline: 'none',
  padding: '4px 0',
  fontFamily: 'inherit',
  resize: 'none',
  borderBottom: '1px solid transparent',
  selectors: {
    '&:focus': {
      borderBottomColor: cssVarV2.layer.insideBorder.primaryBorder,
    },
    '&::placeholder': {
      color: cssVarV2.text.placeholder,
    },
  },
});

export const sections = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 32,
});

export const loading = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  fontSize: cssVar('fontSm'),
  color: cssVarV2.text.secondary,
});

export const notFound = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  height: '100%',
  fontSize: cssVar('fontSm'),
  color: cssVarV2.text.secondary,
});

export const notFoundTitle = style({
  fontSize: cssVar('fontH5'),
  fontWeight: 600,
  color: cssVarV2.text.primary,
});
