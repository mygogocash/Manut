import { cssVar } from '@toeverything/theme';
import { style } from '@vanilla-extract/css';

export const badge = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  height: 20,
  padding: '0 8px',
  borderRadius: 4,
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: 0.2,
});

export const dot = style({
  width: 6,
  height: 6,
  borderRadius: '50%',
});

export const active = style({
  background: cssVar('backgroundTertiaryColor'),
  color: cssVar('successColor'),
});

export const dotActive = style({
  background: cssVar('successColor'),
});

export const paused = style({
  background: cssVar('backgroundTertiaryColor'),
  color: cssVar('textSecondaryColor'),
});

export const dotPaused = style({
  background: cssVar('textSecondaryColor'),
});

export const expired = style({
  background: cssVar('backgroundTertiaryColor'),
  color: cssVar('warningColor'),
});

export const dotExpired = style({
  background: cssVar('warningColor'),
});

export const error = style({
  background: cssVar('backgroundTertiaryColor'),
  color: cssVar('errorColor'),
});

export const dotError = style({
  background: cssVar('errorColor'),
});

export const notConnected = style({
  background: cssVar('backgroundTertiaryColor'),
  color: cssVar('textSecondaryColor'),
});

export const dotNotConnected = style({
  background: cssVar('borderColor'),
});
