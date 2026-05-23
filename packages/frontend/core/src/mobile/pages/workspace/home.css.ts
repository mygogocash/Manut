import { cssVarV2 } from '@toeverything/theme/v2';
import { style } from '@vanilla-extract/css';

export const page = style({
  minHeight: '100dvh',
  paddingBottom: 112,
  background: cssVarV2('layer/background/mobile/primary'),
  color: cssVarV2('text/primary'),
});

export const sections = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 28,
  padding: '0 16px 112px',
});

export const dockSafeArea = style({
  position: 'fixed',
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 4,
  pointerEvents: 'none',
  padding: '0 20px 12px',
});

export const dock = style({
  pointerEvents: 'auto',
  display: 'grid',
  gridTemplateColumns: '54px minmax(0, 1fr) 54px',
  alignItems: 'center',
  gap: 10,
  width: '100%',
  maxWidth: 520,
  margin: '0 auto',
});

export const dockButton = style({
  height: 54,
  minWidth: 0,
  border: `0.5px solid ${cssVarV2('layer/insideBorder/border')}`,
  background: 'var(--manut-surface-glass-strong)',
  backdropFilter: 'blur(20px) saturate(180%)',
  WebkitBackdropFilter: 'blur(20px) saturate(180%)',
  color: cssVarV2('icon/primary'),
  boxShadow: '0 12px 30px rgba(0, 0, 0, 0.18)',
  transition:
    'transform 120ms var(--manut-anim-curve-overshoot), background-color 120ms ease-out',
  selectors: {
    '&:active': {
      transform: 'scale(0.95)',
    },
  },
});

export const dockCircle = style([
  dockButton,
  {
    width: 54,
    borderRadius: '50%',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
  },
]);

export const askAiButton = style([
  dockButton,
  {
    borderRadius: 27,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: '0 18px',
    fontSize: 18,
    fontWeight: 650,
    letterSpacing: 0,
    color: cssVarV2('text/primary'),
    whiteSpace: 'nowrap',
  },
]);

export const askAiIcon = style({
  width: 34,
  height: 34,
  borderRadius: '50%',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  background: cssVarV2('layer/background/mobile/secondary'),
  color: cssVarV2('icon/primary'),
});
