import { cssVarV2 } from '@toeverything/theme/v2';
import { globalStyle, style } from '@vanilla-extract/css';

export const root = style({
  width: '100%',
  boxSizing: 'border-box',
  padding: '12px 12px 10px',
});

export const headerRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  minWidth: 0,
});

export const workspaceChip = style({
  width: 48,
  height: 48,
  flex: '0 0 48px',
  padding: 6,
  borderRadius: '50%',
  overflow: 'hidden',
  border: `0.5px solid ${cssVarV2('layer/insideBorder/border')}`,
  background: 'var(--manut-surface-glass-strong)',
  backdropFilter: 'blur(18px) saturate(180%)',
  WebkitBackdropFilter: 'blur(18px) saturate(180%)',
  boxShadow: '0 12px 30px rgba(0, 0, 0, 0.12)',
});

globalStyle(`${workspaceChip} [data-testid="workspace-avatar"]`, {
  width: '36px',
  height: '36px',
  borderRadius: '50%',
});

export const menuRail = style({
  minWidth: 0,
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  overflowX: 'auto',
  scrollbarWidth: 'none',
  selectors: {
    '&::-webkit-scrollbar': {
      display: 'none',
    },
  },
});

export const menuButton = style({
  position: 'relative',
  flex: '0 0 48px',
  height: 48,
  minWidth: 0,
  border: `0.5px solid ${cssVarV2('layer/insideBorder/border')}`,
  borderRadius: 26,
  padding: '0 12px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden',
  background: cssVarV2('layer/background/mobile/secondary'),
  color: cssVarV2('icon/secondary'),
  fontFamily: 'inherit',
  fontSize: 18,
  fontWeight: 650,
  lineHeight: '24px',
  letterSpacing: 0,
  whiteSpace: 'nowrap',
  boxShadow: '0 8px 22px rgba(0, 0, 0, 0.08)',
  transition:
    'flex-basis 240ms var(--manut-anim-curve-overshoot), transform 160ms var(--manut-anim-curve-overshoot), background-color 180ms ease-out, color 180ms ease-out, box-shadow 180ms ease-out',
  selectors: {
    '&[data-active="true"]': {
      flexBasis: 110,
      background: cssVarV2('layer/background/mobile/primary'),
      color: cssVarV2('text/primary'),
      boxShadow: '0 10px 26px rgba(0, 0, 0, 0.10)',
      gap: 8,
    },
    '&:active': {
      transform: 'scale(0.94)',
    },
    '&:focus-visible': {
      outline: `2px solid ${cssVarV2('button/primary')}`,
      outlineOffset: 2,
    },
  },
});

export const menuIcon = style({
  position: 'relative',
  width: 24,
  height: 24,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  fontSize: 22,
});

export const menuLabel = style({
  display: 'inline-flex',
  maxWidth: 0,
  opacity: 0,
  transform: 'translateX(-4px)',
  overflow: 'hidden',
  transition:
    'max-width 220ms var(--manut-anim-curve-overshoot), opacity 150ms ease-out, transform 220ms var(--manut-anim-curve-overshoot)',
  selectors: {
    [`${menuButton}[data-active="true"] &`]: {
      maxWidth: 104,
      opacity: 1,
      transform: 'translateX(0)',
    },
  },
});

export const notificationBadge = style({
  position: 'absolute',
  top: -1,
  right: -1,
  backgroundColor: cssVarV2('button/primary'),
  width: 8,
  height: 8,
  borderRadius: '50%',
  border: `1.5px solid ${cssVarV2('layer/background/mobile/secondary')}`,
});
