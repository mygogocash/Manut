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
  borderRadius: 'var(--manut-radius-input)',
  border: 'none',
  background: 'var(--manut-primary-fg)',
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
  borderRadius: 'var(--manut-radius-input)',
  border: '1px solid var(--manut-line)',
  background: 'var(--manut-surface-paper)',
  color: 'var(--manut-ink)',
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
  transition:
    'background-color var(--affine-anim-duration-base) var(--affine-anim-curve-default)',
  selectors: {
    '&:hover': { background: 'var(--manut-surface-sunken)' },
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
  letterSpacing: 0,
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
  '@media': {
    '(prefers-reduced-motion: reduce)': {
      animation: 'none',
    },
  },
});

export const paragraph = style({
  margin: 0,
  marginBottom: 6,
  selectors: {
    '&:last-child': { marginBottom: 0 },
  },
});

/* Modal — backdrop/container/title now provided by the shared
   `@affine/component` Modal (Radix Dialog). Only the body + form-field
   styles below remain local. */

export const modalBody = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
});

export const label = style({
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--manut-ink-soft)',
});

export const input = style({
  height: 32,
  padding: '0 10px',
  borderRadius: 'var(--manut-radius-input)',
  border: '1px solid var(--manut-line)',
  background: 'var(--manut-surface-paper)',
  color: 'var(--manut-ink)',
  fontSize: 13,
  outline: 'none',
  transition:
    'border-color var(--affine-anim-duration-base) var(--affine-anim-curve-default), box-shadow var(--affine-anim-duration-base) var(--affine-anim-curve-default)',
  selectors: {
    '&:focus': {
      borderColor: 'var(--manut-primary-fg)',
      boxShadow: '0 0 0 3px var(--manut-primary-bg)',
    },
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
