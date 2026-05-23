import { globalStyle, style } from '@vanilla-extract/css';

export const recentSection = style({
  paddingBottom: 28,
  selectors: {
    '&[data-state="open"]': {
      paddingBottom: 0,
    },
  },
});
export const scroll = style({
  width: '100%',
  paddingTop: 10,
  paddingBottom: 30,
  overflowX: 'auto',
  scrollbarWidth: 'none',
  selectors: {
    '&::-webkit-scrollbar': {
      display: 'none',
    },
  },
});

export const list = style({
  paddingLeft: 20,
  paddingRight: 20,
  display: 'flex',
  gap: 16,
  width: 'fit-content',
});

export const cardWrapper = style({
  width: 176,
  height: 194,
  flexShrink: 0,
});

export const header = style({
  margin: '0 20px',
});

globalStyle(`${cardWrapper} > *`, {
  width: '100%',
  height: '100%',
});
