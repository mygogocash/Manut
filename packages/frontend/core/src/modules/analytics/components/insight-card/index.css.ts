import { cssVar } from '@toeverything/theme';
import { keyframes, style } from '@vanilla-extract/css';

const fadeIn = keyframes({
  '0%': {
    opacity: 0,
    transform: 'translateY(-4px)',
  },
  '100%': {
    opacity: 1,
    transform: 'translateY(0)',
  },
});

export const card = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: '14px 16px',
  borderRadius: 10,
  border: `1px solid ${cssVar('borderColor')}`,
  background: cssVar('backgroundPrimaryColor'),
  selectors: {
    '&[data-acknowledged="true"]': {
      opacity: 0.65,
    },
  },
});

export const cardFresh = style({
  animation: `${fadeIn} var(--affine-anim-duration-base) var(--affine-anim-curve-default)`,
  '@media': {
    '(prefers-reduced-motion: reduce)': {
      animation: 'none',
    },
  },
});

export const headerRow = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
});

export const titleText = style({
  fontSize: 14,
  fontWeight: 600,
  color: cssVar('textPrimaryColor'),
  flex: 1,
  minWidth: 0,
});

export const body = style({
  fontSize: 13,
  lineHeight: 1.5,
  color: cssVar('textSecondaryColor'),
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
});

export const metaRow = style({
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 10,
  fontSize: 11,
  color: cssVar('textSecondaryColor'),
});

export const severityChip = style({
  display: 'inline-flex',
  alignItems: 'center',
  height: 18,
  padding: '0 8px',
  borderRadius: 4,
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: 0.2,
});

export const severityInfo = style({
  background: cssVar('backgroundTertiaryColor'),
  color: cssVar('textSecondaryColor'),
});

export const severityNotable = style({
  background: cssVar('backgroundTertiaryColor'),
  color: cssVar('warningColor'),
});

export const severityActionRequired = style({
  background: cssVar('errorColor'),
  color: cssVar('pureWhite'),
});

export const platformsRow = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: 6,
});

export const platformChip = style({
  display: 'inline-flex',
  alignItems: 'center',
  height: 18,
  padding: '0 6px',
  borderRadius: 4,
  background: cssVar('backgroundTertiaryColor'),
  color: cssVar('textPrimaryColor'),
  fontSize: 10,
  fontWeight: 500,
});

export const modelChip = style({
  display: 'inline-flex',
  alignItems: 'center',
  height: 18,
  padding: '0 6px',
  borderRadius: 4,
  border: `1px dashed ${cssVar('borderColor')}`,
  color: cssVar('textSecondaryColor'),
  fontSize: 10,
  fontWeight: 500,
});

export const actionsRow = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  marginLeft: 'auto',
});

export const actionButton = style({
  display: 'inline-flex',
  alignItems: 'center',
  height: 22,
  padding: '0 10px',
  borderRadius: 4,
  border: `1px solid ${cssVar('borderColor')}`,
  background: cssVar('backgroundPrimaryColor'),
  color: cssVar('textPrimaryColor'),
  fontSize: 11,
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
