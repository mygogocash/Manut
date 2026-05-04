import { cssVar } from '@toeverything/theme';
import { style } from '@vanilla-extract/css';

export const card = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  padding: '16px 18px',
  borderRadius: 10,
  border: `1px solid ${cssVar('borderColor')}`,
  background: cssVar('backgroundPrimaryColor'),
  minWidth: 0,
});

export const label = style({
  fontSize: 12,
  fontWeight: 500,
  color: cssVar('textSecondaryColor'),
  textTransform: 'uppercase',
  letterSpacing: 0.4,
});

export const value = style({
  fontSize: 28,
  fontWeight: 600,
  color: cssVar('textPrimaryColor'),
  lineHeight: 1.1,
});

export const deltaRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 12,
});

export const deltaPositive = style({
  color: cssVar('successColor'),
  fontWeight: 500,
});

export const deltaNegative = style({
  color: cssVar('errorColor'),
  fontWeight: 500,
});

export const deltaNeutral = style({
  color: cssVar('textSecondaryColor'),
});
