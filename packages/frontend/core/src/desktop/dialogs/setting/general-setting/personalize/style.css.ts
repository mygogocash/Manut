import { cssVar } from '@toeverything/theme';
import { style } from '@vanilla-extract/css';

export const errorMessage = style({
  color: cssVar('errorColor'),
});

export const textareaWrapper = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  width: '100%',
});

export const textarea = style({
  width: '100%',
  minHeight: 160,
  padding: '12px 14px',
  borderRadius: 8,
  border: `1px solid ${cssVar('borderColor')}`,
  background: cssVar('backgroundPrimaryColor'),
  color: cssVar('textPrimaryColor'),
  fontFamily: 'inherit',
  fontSize: 14,
  lineHeight: 1.5,
  resize: 'vertical',
  outline: 'none',

  ':focus': {
    borderColor: cssVar('primaryColor'),
  },

  '::placeholder': {
    color: cssVar('textSecondaryColor'),
  },
});

export const footer = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  fontSize: 12,
  color: cssVar('textSecondaryColor'),
});

export const counter = style({
  fontVariantNumeric: 'tabular-nums',
});

export const counterError = style({
  color: cssVar('errorColor'),
});

export const status = style({
  fontStyle: 'italic',
});
