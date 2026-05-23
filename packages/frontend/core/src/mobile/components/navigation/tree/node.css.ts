import { cssVar } from '@toeverything/theme';
import { bodyRegular } from '@toeverything/theme/typography';
import { cssVarV2 } from '@toeverything/theme/v2';
import { createVar, style } from '@vanilla-extract/css';

export const levelIndent = createVar();

export const itemRoot = style({
  display: 'flex',
  alignItems: 'center',
  textAlign: 'left',
  color: 'inherit',
  width: '100%',
  minHeight: '44px',
  userSelect: 'none',
  cursor: 'pointer',
  fontSize: 17,
  position: 'relative',
  marginTop: '0px',
  padding: '4px 0',
  borderRadius: 0,
  gap: 8,
  transition:
    'opacity 120ms ease-out, transform 200ms var(--manut-anim-curve-overshoot)',
  selectors: {
    '&[data-disabled="true"]': {
      cursor: 'default',
      color: cssVar('textSecondaryColor'),
      pointerEvents: 'none',
    },
    '&[data-dragging="true"]': {
      opacity: 0.5,
      transform: 'rotate(-1.5deg) scale(1.02)',
      pointerEvents: 'none',
    },
  },
});

export const collapsedIconContainer = style({
  order: -1,
  width: '24px',
  height: '24px',
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '2px',
  transition: 'transform 0.2s',
  color: cssVarV2('icon/primary'),
  fontSize: 16,
  selectors: {
    '&[data-collapsed="true"]': {
      transform: 'rotate(-90deg)',
    },
    '&[data-disabled="true"]': {
      opacity: 0.3,
      pointerEvents: 'none',
    },
  },
});
export const collapsedIcon = style({
  transition: 'transform 0.2s ease-in-out',
  selectors: {
    '&[data-collapsed="true"]': {
      transform: 'rotate(-90deg)',
    },
  },
});

export const itemMain = style({
  display: 'flex',
  alignItems: 'center',
  width: 0,
  flex: 1,
  position: 'relative',
  gap: 10,
});

export const iconContainer = style({
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  color: cssVarV2('icon/primary'),

  width: 30,
  height: 30,
  flexShrink: 0,
  fontSize: 24,
});

export const itemContent = style([
  bodyRegular,
  {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    alignItems: 'center',
    flex: 1,
    color: cssVarV2('text/primary'),
    fontSize: 17,
    lineHeight: '24px',
    letterSpacing: 0,
  },
]);

export const itemRenameAnchor = style({
  pointerEvents: 'none',
  position: 'absolute',
  left: 0,
  top: -10,
  width: 10,
  height: 10,
});

export const contentContainer = style({
  marginTop: 0,
  paddingLeft: levelIndent,
  position: 'relative',
});

export const linkItemRoot = style({
  color: 'inherit',
});

export const collapseContentPlaceholder = style({
  display: 'none',
  selectors: {
    '&:only-child': {
      display: 'initial',
    },
  },
});
