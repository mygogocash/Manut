import { cssVar } from '@toeverything/theme';
import { keyframes, style } from '@vanilla-extract/css';

const skeletonShimmer = keyframes({
  '0%': { opacity: 0.6 },
  '50%': { opacity: 1 },
  '100%': { opacity: 0.6 },
});

export const root = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  padding: '24px 32px',
  width: '100%',
  maxWidth: 800,
  margin: '0 auto',
  flex: 1,
  overflow: 'auto',
});

export const headerBar = style({
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 12,
});

export const title = style({
  fontSize: 22,
  fontWeight: 600,
  color: cssVar('textPrimaryColor'),
});

export const subtitle = style({
  fontSize: 13,
  color: cssVar('textSecondaryColor'),
});

export const primaryButton = style({
  display: 'inline-flex',
  alignItems: 'center',
  height: 32,
  padding: '0 14px',
  borderRadius: 6,
  border: 'none',
  background: cssVar('primaryColor'),
  color: cssVar('pureWhite'),
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
  transition:
    'opacity var(--affine-anim-duration-base) var(--affine-anim-curve-default)',
  selectors: {
    '&:hover': { opacity: 0.9 },
    '&[disabled]': { opacity: 0.5, cursor: 'not-allowed' },
  },
});

export const secondaryButton = style({
  display: 'inline-flex',
  alignItems: 'center',
  height: 32,
  padding: '0 14px',
  borderRadius: 6,
  border: `1px solid ${cssVar('borderColor')}`,
  background: cssVar('backgroundPrimaryColor'),
  color: cssVar('textPrimaryColor'),
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
  transition:
    'background-color var(--affine-anim-duration-base) var(--affine-anim-curve-default)',
  selectors: {
    '&:hover': { background: cssVar('backgroundTertiaryColor') },
    '&[disabled]': { opacity: 0.5, cursor: 'not-allowed' },
  },
});

export const groups = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 18,
});

export const group = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
});

export const groupLabel = style({
  fontSize: 11,
  fontWeight: 600,
  color: cssVar('textSecondaryColor'),
  textTransform: 'uppercase',
  letterSpacing: 0.4,
});

export const list = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
});

export const empty = style({
  padding: '48px 16px',
  textAlign: 'center',
  color: cssVar('textSecondaryColor'),
  fontSize: 14,
  border: `1px dashed ${cssVar('borderColor')}`,
  borderRadius: 10,
});

export const skeleton = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
});

export const skeletonBlock = style({
  height: 64,
  borderRadius: 10,
  background: cssVar('backgroundTertiaryColor'),
  animation: `${skeletonShimmer} 1.4s ease-in-out infinite`,
});

export const paragraph = style({
  margin: 0,
  marginBottom: 6,
  selectors: {
    '&:last-child': { marginBottom: 0 },
  },
});

/* Modal */

export const modalBackdrop = style({
  position: 'fixed',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.4)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 100,
});

export const modal = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  padding: 20,
  borderRadius: 10,
  border: `1px solid ${cssVar('borderColor')}`,
  background: cssVar('backgroundPrimaryColor'),
  width: 'min(420px, 92vw)',
  boxShadow: '0 12px 32px rgba(0, 0, 0, 0.18)',
});

export const modalTitle = style({
  fontSize: 16,
  fontWeight: 600,
  color: cssVar('textPrimaryColor'),
});

export const modalBody = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
});

export const label = style({
  fontSize: 12,
  fontWeight: 500,
  color: cssVar('textSecondaryColor'),
});

export const input = style({
  height: 32,
  padding: '0 10px',
  borderRadius: 6,
  border: `1px solid ${cssVar('borderColor')}`,
  background: cssVar('backgroundPrimaryColor'),
  color: cssVar('textPrimaryColor'),
  fontSize: 13,
  outline: 'none',
  transition:
    'border-color var(--affine-anim-duration-base) var(--affine-anim-curve-default)',
  selectors: {
    '&:focus': { borderColor: cssVar('primaryColor') },
    '&[disabled]': { opacity: 0.6 },
  },
});

export const error = style({
  fontSize: 12,
  color: cssVar('errorColor'),
});

export const modalActions = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: 8,
});
