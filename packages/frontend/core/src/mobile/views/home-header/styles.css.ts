import { cssVarV2 } from '@toeverything/theme/v2';
import { createVar, globalStyle, style } from '@vanilla-extract/css';

const headerHeight = createVar('headerHeight');
const wsSelectorHeight = createVar('wsSelectorHeight');
const searchHeight = createVar('searchHeight');

export const root = style({
  vars: {
    [headerHeight]: '44px',
    [wsSelectorHeight]: '48px',
    [searchHeight]: '44px',
  },
  width: '100dvw',
});
export const headerSettingRow = style({
  height: 44,
});
export const wsSelectorAndSearch = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 15,
  padding: '4px 16px 15px 16px',
});

// Manut display typography for the expanded workspace identity.
// Targets the workspace-name label rendered inside WorkspaceSelector
// (sibling .css.ts owned by workspace-selector module). vanilla-extract
// requires `globalStyle` for descendant selectors — they can't live in
// `selectors:` which is scoped to the current class only.
globalStyle(`${wsSelectorAndSearch} [class*="label"]`, {
  fontSize: 'var(--manut-display-1)',
  fontWeight: 'var(--manut-display-weight)',
  letterSpacing: '-0.02em',
  lineHeight: 1.05,
});

export const float = style({
  position: 'fixed',
  top: 0,
  width: '100%',
  zIndex: 2,

  display: 'flex',
  alignItems: 'center',
  padding: '4px 10px 4px 16px',
  gap: 10,

  // visibility control + spring collapse motion
  background: 'transparent',
  transition:
    'transform 220ms var(--manut-anim-curve-spring), opacity 220ms ease-out, background 220ms ease-out',
  selectors: {
    '&.dense': {
      background: cssVarV2('layer/background/mobile/primary'),
    },
  },
});
export const floatWsSelector = style({
  width: 0,
  flex: 1,
  visibility: 'hidden',
  pointerEvents: 'none',
  opacity: 0,
  transform: 'translateY(-4px)',
  transition:
    'opacity 220ms var(--manut-anim-curve-spring), transform 220ms var(--manut-anim-curve-spring)',
  selectors: {
    [`${float}.dense &`]: {
      visibility: 'visible',
      pointerEvents: 'auto',
      opacity: 1,
      transform: 'translateY(0)',
    },
  },
});

export const notificationBadge = style({
  position: 'absolute',
  top: -2,
  right: -2,
  backgroundColor: cssVarV2('button/primary'),
  color: cssVarV2('text/pureWhite'),
  width: '16px',
  height: '16px',
  fontSize: '12px',
  lineHeight: '16px',
  borderRadius: '50%',
  textAlign: 'center',
});
