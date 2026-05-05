import { cssVar } from '@toeverything/theme';
import { keyframes, style } from '@vanilla-extract/css';

const skeletonShimmer = keyframes({
  '0%': { opacity: 0.5 },
  '50%': { opacity: 0.9 },
  '100%': { opacity: 0.5 },
});

export const root = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
});

export const title = style({
  fontSize: 18,
  fontWeight: 600,
  color: cssVar('textPrimaryColor'),
});

export const subtitle = style({
  fontSize: 13,
  color: cssVar('textSecondaryColor'),
  marginBottom: 8,
});

export const list = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
});

export const row = style({
  display: 'grid',
  gridTemplateColumns: '1fr auto',
  alignItems: 'center',
  gap: 12,
  padding: '12px 16px',
  borderRadius: 8,
  border: `1px solid ${cssVar('borderColor')}`,
  background: cssVar('backgroundPrimaryColor'),
});

export const rowMain = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  minWidth: 0,
});

export const platformName = style({
  fontSize: 14,
  fontWeight: 500,
  color: cssVar('textPrimaryColor'),
});

export const accountHandle = style({
  fontSize: 12,
  color: cssVar('textSecondaryColor'),
});

export const lastSync = style({
  fontSize: 11,
  color: cssVar('textSecondaryColor'),
});

export const actionsRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
});

export const button = style({
  display: 'inline-flex',
  alignItems: 'center',
  height: 28,
  padding: '0 12px',
  borderRadius: 6,
  border: `1px solid ${cssVar('borderColor')}`,
  background: cssVar('backgroundPrimaryColor'),
  color: cssVar('textPrimaryColor'),
  fontSize: 12,
  fontWeight: 500,
  cursor: 'pointer',
  transition:
    'background-color var(--affine-anim-duration-base) var(--affine-anim-curve-default)',
  selectors: {
    '&:hover': {
      background: cssVar('backgroundTertiaryColor'),
    },
    '&[disabled]': {
      opacity: 0.5,
      cursor: 'not-allowed',
    },
  },
});

export const buttonPrimary = style({
  background: cssVar('primaryColor'),
  color: cssVar('pureWhite'),
  border: 'none',
  selectors: {
    '&:hover': {
      opacity: 0.9,
    },
  },
});

export const empty = style({
  padding: '32px 16px',
  textAlign: 'center',
  color: cssVar('textSecondaryColor'),
  fontSize: 13,
});

export const lockedNotice = style({
  padding: '12px 14px',
  borderRadius: 8,
  background: cssVar('backgroundTertiaryColor'),
  color: cssVar('textSecondaryColor'),
  fontSize: 12,
});

export const bannerError = style({
  display: 'flex',
  alignItems: 'flex-start',
  gap: 8,
  padding: '12px 14px',
  borderRadius: 8,
  background: cssVar('errorColor'),
  color: cssVar('pureWhite'),
  fontSize: 12,
});

export const bannerErrorText = style({
  flex: 1,
  minWidth: 0,
  wordBreak: 'break-word',
});

export const bannerErrorDismiss = style({
  flexShrink: 0,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 20,
  height: 20,
  marginTop: -2,
  borderRadius: 4,
  border: 'none',
  background: 'transparent',
  color: cssVar('pureWhite'),
  cursor: 'pointer',
  padding: 0,
  fontSize: 14,
  lineHeight: 1,
  transition:
    'background-color var(--affine-anim-duration-base) var(--affine-anim-curve-default)',
  selectors: {
    '&:hover': {
      background: 'rgba(255, 255, 255, 0.18)',
    },
    '&:focus-visible': {
      outline: '2px solid rgba(255, 255, 255, 0.6)',
      outlineOffset: 1,
    },
  },
});

export const rowBanner = style({
  gridColumn: '1 / -1',
  padding: '8px 12px',
  borderRadius: 6,
  fontSize: 12,
});

export const rowBannerWarning = style({
  background: cssVar('backgroundTertiaryColor'),
  color: cssVar('warningColor'),
});

export const rowBannerError = style({
  background: cssVar('errorColor'),
  color: cssVar('pureWhite'),
});

export const skeletonRow = style({
  height: 56,
  borderRadius: 8,
  background: cssVar('backgroundTertiaryColor'),
  animation: `${skeletonShimmer} 1.4s ease-in-out infinite`,
});
