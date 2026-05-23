import { cssVar } from '@toeverything/theme';
import {
  bodyEmphasized,
  bodyRegular,
  footnoteRegular,
} from '@toeverything/theme/typography';
import { cssVarV2 } from '@toeverything/theme/v2';
import { style } from '@vanilla-extract/css';

export const root = style({
  maxHeight:
    'calc(100dvh - 100px - env(safe-area-inset-bottom) - env(safe-area-inset-top))',
  display: 'flex',
  flexDirection: 'column',
  width: 'min(390px, calc(100dvw - 28px))',
  padding: '8px 0 10px',
  borderRadius: 20,
  background: cssVarV2('layer/background/mobile/primary'),
  boxShadow: '0 22px 52px rgba(0, 0, 0, 0.22)',
  overflow: 'hidden',
});

export const divider = style({
  height: 16,
  display: 'flex',
  alignItems: 'center',
  position: 'relative',
  flexShrink: 0,
  ':before': {
    content: '""',
    width: '100%',
    height: 0.5,
    background: cssVar('dividerColor'),
  },
});

export const head = style([
  bodyEmphasized,
  {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
    padding: '12px 16px 10px',
    color: cssVarV2('text/primary'),
    fontSize: 17,
    lineHeight: '24px',
  },
]);
export const headActions = style({
  display: 'flex',
  alignItems: 'center',
  gap: 14,
});
export const body = style({
  overflowY: 'auto',
  flexShrink: 0,
  flex: 1,
  padding: '2px 0 4px',
});
export const wsList = style({});
export const wsListTitle = style([
  footnoteRegular,
  {
    padding: '6px 16px',
    color: cssVar('textSecondaryColor'),
  },
]);
export const wsItem = style({
  padding: '3px 10px',
});
export const wsCard = style({
  display: 'flex',
  alignItems: 'center',
  border: 'none',
  background: 'none',
  width: '100%',
  minHeight: 52,
  padding: '8px 10px',
  borderRadius: 12,
  gap: 10,
  color: cssVarV2('text/primary'),
  transition:
    'transform 150ms var(--manut-anim-curve-overshoot), background-color 150ms ease-out',

  ':active': {
    background: cssVarV2('layer/background/hoverOverlay'),
    transform: 'scale(0.98)',
  },
  ':focus-visible': {
    outline: `2px solid ${cssVarV2('button/primary')}`,
    outlineOffset: -2,
  },
});
export const wsName = style([
  bodyRegular,
  {
    width: 0,
    flex: 1,
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textAlign: 'left',
  },
]);
export const signInIcon = style({
  width: 32,
  height: 32,
  borderRadius: 6,
  border: `1px solid ${cssVarV2.tab.divider.divider}`,
  color: cssVarV2.icon.primary,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 20,
});

export const serverInfo = style({
  padding: '6px 20px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
});
export const serverName = style([
  footnoteRegular,
  {
    color: cssVarV2.text.secondary,
    flexShrink: 0,
  },
]);
export const serverAccount = style([
  serverName,
  {
    flexShrink: 1,
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
  },
]);
export const spaceX = style({
  width: 0,
  flex: 1,
});
