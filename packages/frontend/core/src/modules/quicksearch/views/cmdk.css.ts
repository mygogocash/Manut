import { cssVar } from '@toeverything/theme';
import { cssVarV2 } from '@toeverything/theme/v2';
import { globalStyle, style } from '@vanilla-extract/css';

export const root = style({});

export const itemIcon = style({
  fontSize: 20,
  width: '1em',
  height: '1em',
  marginRight: 16,
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: cssVar('iconSecondary'),
});

export const itemLabel = style({
  fontSize: 14,
  lineHeight: '1.5',
  color: cssVar('textPrimaryColor'),
  flex: 1,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

globalStyle(`${root} [cmdk-root]`, {
  height: '100%',
});
globalStyle(`${root} [cmdk-group-heading]`, {
  padding: '8px',
  color: cssVar('textSecondaryColor'),
  fontSize: cssVar('fontXs'),
  fontWeight: 600,
  lineHeight: '1.67',
});
globalStyle(`${root} [cmdk-group][hidden]`, {
  display: 'none',
});
globalStyle(`${root} [cmdk-list]`, {
  maxHeight: 400,
  minHeight: 80,
  overflow: 'auto',
  overscrollBehavior: 'contain',
  height: 'min(330px, calc(var(--cmdk-list-height) + 8px))',
  margin: '8px 6px',
  scrollbarGutter: 'stable',
  scrollPaddingBlock: '12px',
  scrollbarWidth: 'thin',
  scrollbarColor: `${cssVar('iconColor')} transparent`,
});
globalStyle(`${root} [cmdk-list]:not([data-opening])`, {
  transition: 'height .1s ease',
});
globalStyle(`${root} [cmdk-list]::-webkit-scrollbar`, {
  width: 6,
  height: 6,
});
globalStyle(`${root} [cmdk-list]::-webkit-scrollbar-thumb`, {
  borderRadius: 4,
  backgroundClip: 'padding-box',
});
globalStyle(`${root} [cmdk-list]:hover::-webkit-scrollbar-thumb`, {
  backgroundColor: cssVar('dividerColor'),
});
globalStyle(`${root} [cmdk-list]:hover::-webkit-scrollbar-thumb:hover`, {
  backgroundColor: cssVar('iconColor'),
});
globalStyle(`${root} [cmdk-item]`, {
  display: 'flex',
  minHeight: 44,
  padding: '6px 12px',
  alignItems: 'center',
  cursor: 'default',
  borderRadius: 4,
  userSelect: 'none',
  // Manut motion polish — gentle hover scale for cmdk result rows.
  // 1.02 matches the Linear / Notion micro-feel where rows lean in
  // slightly on pointer-over. Transition runs on transform only so
  // the layout never reflows. Scale is GPU-accelerated. The
  // @media (prefers-reduced-motion: reduce) clause below disables
  // the transform entirely so a reduced-motion user sees an
  // unmoving row — only the background colour swap remains.
  transformOrigin: 'left center',
  transition:
    'background-color var(--affine-anim-duration-fast) var(--affine-anim-curve-default), transform 160ms cubic-bezier(0.34, 1.56, 0.64, 1)',
  willChange: 'transform',
  '@media': {
    '(prefers-reduced-motion: reduce)': {
      transition:
        'background-color var(--affine-anim-duration-fast) var(--affine-anim-curve-default)',
    },
  },
});
globalStyle(`${root} [cmdk-item]:hover`, {
  transform: 'scale(1.015)',
  '@media': {
    '(prefers-reduced-motion: reduce)': {
      transform: 'none',
    },
  },
});
globalStyle(`${root} [cmdk-item][data-selected=true]`, {
  background: cssVar('backgroundSecondaryColor'),
  transform: 'scale(1.02)',
  '@media': {
    '(prefers-reduced-motion: reduce)': {
      transform: 'none',
    },
  },
});
globalStyle(`${root} [cmdk-item][data-selected=true][data-is-danger=true]`, {
  background: cssVar('backgroundErrorColor'),
  color: cssVar('errorColor'),
});
globalStyle(`${root} [cmdk-item][data-selected=true] ${itemIcon}`, {
  color: cssVar('iconColor'),
});
globalStyle(
  `${root} [cmdk-item][data-selected=true][data-is-danger=true] ${itemIcon}`,
  {
    color: cssVar('errorColor'),
  }
);
globalStyle(
  `${root} [cmdk-item][data-selected=true][data-is-danger=true] ${itemLabel}`,
  {
    color: cssVar('errorColor'),
  }
);

export const panelContainer = style({
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
});

export const pageTitleWrapper = style({
  display: 'flex',
  alignItems: 'center',
  padding: '18px 16px 0',
  width: '100%',
});

export const pageTitle = style({
  padding: '2px 6px',
  borderRadius: 4,
  fontSize: cssVar('fontXs'),
  lineHeight: '20px',
  color: cssVar('textSecondaryColor'),
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  maxWidth: '100%',
  backgroundColor: cssVar('backgroundSecondaryColor'),
});

export const searchInputContainer = style({
  height: 66,
  padding: '18px 16px',
  marginBottom: '8px',
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  borderBottom: `1px solid ${cssVar('borderColor')}`,
  flexShrink: 0,
});

export const hasInputLabel = style([
  searchInputContainer,
  {
    paddingTop: '12px',
    paddingBottom: '18px',
  },
]);

export const searchInput = style({
  color: cssVar('textPrimaryColor'),
  fontSize: cssVar('fontH5'),
  width: '100%',
  '::placeholder': {
    color: cssVar('textSecondaryColor'),
  },
});

export const timestamp = style({
  display: 'flex',
  fontSize: cssVar('fontXs'),
  color: cssVar('textSecondaryColor'),
  minWidth: 120,
  flexDirection: 'row-reverse',
});

export const keybinding = style({
  display: 'flex',
  fontSize: cssVar('fontXs'),
  columnGap: 2,
});

export const keybindingFragment = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0 4px',
  borderRadius: 4,
  color: cssVar('textSecondaryColor'),
  backgroundColor: cssVar('backgroundTertiaryColor'),
  minWidth: 24,
  height: 20,
  textTransform: 'uppercase',
});

export const itemTitle = style({
  fontSize: cssVar('fontBase'),
  lineHeight: '24px',
  fontWeight: 400,
  textAlign: 'justify',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
});
export const itemSubtitle = style({
  fontSize: cssVar('fontXs'),
  lineHeight: '20px',
  fontWeight: 400,
  textAlign: 'justify',
});

export const errorMessage = style({
  padding: '0px 8px 8px',
  fontSize: cssVar('fontXs'),
  color: cssVarV2('status/error'),
});
