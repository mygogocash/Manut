import { style } from '@vanilla-extract/css';

export const root = style({
  minHeight: '100vh',
  background: 'var(--affine-background-primary-color)',
  color: 'var(--affine-text-primary-color)',
});

export const shell = style({
  boxSizing: 'border-box',
  width: 'min(920px, calc(100% - 40px))',
  margin: '0 auto',
  padding: '72px 0 88px',
});

export const backLink = style({
  display: 'inline-flex',
  alignItems: 'center',
  color: 'var(--affine-text-secondary-color)',
  fontSize: 14,
  lineHeight: '22px',
  textDecoration: 'none',
  marginBottom: 36,
  transition:
    'color var(--affine-anim-duration-base) var(--affine-anim-curve-default)',
  selectors: {
    '&:hover': {
      color: 'var(--affine-text-primary-color)',
    },
  },
});

export const eyebrow = style({
  margin: '0 0 12px',
  color: 'var(--affine-text-secondary-color)',
  fontSize: 14,
  lineHeight: '22px',
});

export const title = style({
  margin: 0,
  fontSize: 56,
  lineHeight: '64px',
  fontWeight: 700,
  letterSpacing: 0,
});

export const description = style({
  maxWidth: 680,
  margin: '18px 0 0',
  color: 'var(--affine-text-secondary-color)',
  fontSize: 18,
  lineHeight: '30px',
});

export const nav = style({
  display: 'flex',
  gap: 12,
  marginTop: 28,
  flexWrap: 'wrap',
});

export const navLink = style({
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 36,
  padding: '0 14px',
  borderRadius: 6,
  border: '1px solid var(--affine-border-color)',
  color: 'var(--affine-text-primary-color)',
  fontSize: 14,
  textDecoration: 'none',
  transition:
    'background-color var(--affine-anim-duration-base) var(--affine-anim-curve-default), border-color var(--affine-anim-duration-base) var(--affine-anim-curve-default)',
  selectors: {
    '&:hover': {
      background: 'var(--affine-hover-color)',
      borderColor: 'var(--affine-border-color)',
    },
  },
});

export const content = style({
  marginTop: 52,
  borderTop: '1px solid var(--affine-border-color)',
});

export const section = style({
  padding: '32px 0',
  borderBottom: '1px solid var(--affine-border-color)',
});

export const sectionHeading = style({
  margin: '0 0 14px',
  fontSize: 22,
  lineHeight: '30px',
  fontWeight: 650,
  letterSpacing: 0,
});

export const paragraph = style({
  maxWidth: 780,
  margin: '12px 0 0',
  color: 'var(--affine-text-primary-color)',
  fontSize: 16,
  lineHeight: '27px',
});
