import { cssVar } from '@toeverything/theme';
import { style } from '@vanilla-extract/css';

export const list = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  marginTop: 12,
  // Cap the modal height so a 50-account list scrolls instead of growing
  // off-screen. Matches the modal's internal 80vh cap.
  maxHeight: 360,
  overflowY: 'auto',
});

export const row = style({
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '10px 12px',
  borderRadius: 8,
  border: `1px solid ${cssVar('borderColor')}`,
  background: cssVar('backgroundPrimaryColor'),
  cursor: 'pointer',
  selectors: {
    '&:hover': {
      background: cssVar('backgroundSecondaryColor'),
    },
    '&[data-selected="true"]': {
      borderColor: cssVar('primaryColor'),
      background: cssVar('backgroundTertiaryColor'),
    },
    '&[data-disabled="true"]': {
      opacity: 0.5,
      cursor: 'not-allowed',
    },
  },
});

export const radio = style({
  width: 16,
  height: 16,
  flexShrink: 0,
  margin: 0,
  cursor: 'inherit',
});

export const accountMain = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  minWidth: 0,
  flex: 1,
});

export const accountName = style({
  fontSize: 14,
  fontWeight: 500,
  color: cssVar('textPrimaryColor'),
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const accountId = style({
  fontSize: 11,
  color: cssVar('textSecondaryColor'),
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const footer = style({
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 8,
  marginTop: 16,
});

export const button = style({
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

export const errorBanner = style({
  marginTop: 12,
  padding: '8px 12px',
  borderRadius: 6,
  background: cssVar('errorColor'),
  color: cssVar('pureWhite'),
  fontSize: 12,
});
