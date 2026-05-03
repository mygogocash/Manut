// Animation tokens are referenced as raw CSS variables (not via the
// `animationToken` TS export) so this `.css.ts` file evaluates inside
// vanilla-extract's Node VM without dragging in the `@affine/component`
// package's DOM-touching code (which references HTMLElement at module
// level and would crash the build-time eval).
import { cssVar } from '@toeverything/theme';
import { cssVarV2 } from '@toeverything/theme/v2';
import { style } from '@vanilla-extract/css';
export const linkItemRoot = style({
  color: 'inherit',
});
export const root = style({
  display: 'inline-flex',
  alignItems: 'center',
  borderRadius: '4px',
  textAlign: 'left',
  color: 'inherit',
  width: '100%',
  minHeight: '30px',
  userSelect: 'none',
  cursor: 'pointer',
  padding: '0 2px 0 0',
  fontSize: cssVar('fontSm'),
  marginTop: '4px',
  position: 'relative',
  transition: `background-color var(--affine-anim-duration-base) var(--affine-anim-curve-default)`,
  selectors: {
    '&:hover': {
      background: cssVarV2.layer.background.hoverOverlay,
    },
    '&[data-active="true"]': {
      background: cssVarV2.layer.background.hoverOverlay,
    },
    '&[data-disabled="true"]': {
      cursor: 'default',
      color: cssVarV2.text.disable,
      pointerEvents: 'none',
    },
    // this is not visible in dark mode
    // '&[data-active="true"]:hover': {
    //   background:
    //     // make this a variable?
    //     'linear-gradient(0deg, rgba(0, 0, 0, 0.04), rgba(0, 0, 0, 0.04)), rgba(0, 0, 0, 0.04)',
    // },
    '&[data-collapsible="true"]': {
      paddingLeft: '4px',
      paddingRight: '4px',
    },
    '&[data-collapsible="false"]:is([data-active="true"], :hover)': {
      width: 'calc(100% + 8px + 8px)',
      transform: 'translateX(-8px)',
      paddingLeft: '8px',
      paddingRight: '10px',
    },
    [`${linkItemRoot}:first-of-type &`]: {
      marginTop: '0px',
    },
  },
});
export const content = style({
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  flex: 1,
});
export const postfix = style({
  right: '4px',
  position: 'absolute',
  opacity: 0,
  pointerEvents: 'none',
  transition: `opacity var(--affine-anim-duration-base) var(--affine-anim-curve-default)`,
  selectors: {
    [`${root}:hover &, &[data-postfix-display="always"]`]: {
      justifySelf: 'flex-end',
      position: 'initial',
      opacity: 1,
      pointerEvents: 'all',
    },
  },
});
export const icon = style({
  color: cssVarV2('icon/primary'),
  fontSize: '20px',
});
export const collapsedIconContainer = style({
  width: '16px',
  height: '16px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '2px',
  transition: `transform var(--affine-anim-duration-base) var(--affine-anim-curve-default), background-color var(--affine-anim-duration-base) var(--affine-anim-curve-default)`,
  color: 'inherit',
  selectors: {
    '&[data-collapsed="true"]': {
      transform: 'rotate(-90deg)',
    },
    '&[data-disabled="true"]': {
      opacity: 0.3,
      pointerEvents: 'none',
    },
    '&:hover': {
      background: cssVarV2.layer.background.hoverOverlay,
    },
  },
});
export const iconsContainer = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-start',
  width: '32px',
  flexShrink: 0,
  selectors: {
    '&[data-collapsible="true"]': {
      width: '44px',
    },
  },
});
export const collapsedIcon = style({
  transition: `transform var(--affine-anim-duration-base) var(--affine-anim-curve-default)`,
  selectors: {
    '&[data-collapsed="true"]': {
      transform: 'rotate(-90deg)',
    },
  },
});
export const spacer = style({
  flex: 1,
});
