import { cssVarV2 } from '@toeverything/theme/v2';
import { style } from '@vanilla-extract/css';

export const page = style({
  minHeight: '100dvh',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 12,
  padding: '24px 28px',
  textAlign: 'center',
  background: cssVarV2('layer/background/mobile/primary'),
  color: cssVarV2('text/secondary'),
});

export const icon = style({
  width: 56,
  height: 56,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 16,
  color: cssVarV2('icon/secondary'),
  fontSize: 40,
});

export const title = style({
  margin: 0,
  color: cssVarV2('text/primary'),
  fontSize: 24,
  lineHeight: '30px',
  fontWeight: 700,
  letterSpacing: 0,
});

export const copy = style({
  maxWidth: 280,
  margin: 0,
  color: cssVarV2('text/secondary'),
  fontSize: 17,
  lineHeight: '26px',
  letterSpacing: 0,
});

export const action = style({
  marginTop: 8,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 44,
  padding: '0 22px',
  borderRadius: 22,
  border: 0,
  background: cssVarV2('button/primary'),
  color: cssVarV2('button/pureWhiteText'),
  fontSize: 17,
  lineHeight: '24px',
  fontWeight: 600,
  letterSpacing: 0,
  textDecoration: 'none',
  transition: 'transform 150ms ease-out',
  selectors: {
    '&:active': {
      transform: 'scale(0.96)',
    },
  },
  '@media': {
    '(prefers-reduced-motion: reduce)': {
      transition: 'none',
    },
  },
});
