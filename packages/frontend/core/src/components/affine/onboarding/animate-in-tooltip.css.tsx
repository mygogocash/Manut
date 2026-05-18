import { keyframes, style } from '@vanilla-extract/css';

import { onboardingVars } from './style.css';

const fadeIn = keyframes({
  from: { opacity: 0, pointerEvents: 'none' },
  to: { opacity: 1, pointerEvents: 'auto' },
});

export const tooltip = style({
  width: 560,
  textAlign: 'center',
  fontFamily: 'var(--affine-font-family)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '12px',
  opacity: 0,
  animation: `${fadeIn} 1s ease forwards`,
  animationDelay: onboardingVars.animateIn.tooltipShowUpDelay,
  color: '#121212',
  selectors: {
    '[data-is-desktop="true"] &': {
      color: 'white',
      textShadow: '0px 0px 4px rgba(66, 65, 73, 0.14)',
    },
  },
});

export const headline = style({
  fontSize: 'var(--manut-display-2)',
  fontWeight: 'var(--manut-display-weight)',
  letterSpacing: 'var(--manut-display-letter-spacing)',
  lineHeight: 'var(--manut-display-line-height)',
  color: 'var(--manut-accent-blue-fg)',
  selectors: {
    '[data-is-desktop="true"] &': {
      color: 'white',
    },
  },
});

export const tagline = style({
  fontSize: '20px',
  lineHeight: '28px',
  fontWeight: 600,
});

export const next = style({
  position: 'absolute',
  top: 0,
  right: 0,
  opacity: 0,
  animation: `${fadeIn} 1s ease forwards`,
  animationDelay: onboardingVars.animateIn.nextButtonShowUpDelay,
});
