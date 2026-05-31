import { cssVarV2 } from '@toeverything/theme/v2';
import { globalStyle, keyframes, style } from '@vanilla-extract/css';

const surfaceIn = keyframes({
  '0%': {
    opacity: 0,
    transform: 'translateY(12px) scale(0.985)',
  },
  '100%': {
    opacity: 1,
    transform: 'translateY(0) scale(1)',
  },
});

export const page = style({
  minHeight: '100dvh',
  paddingBottom: 112,
  background: cssVarV2('layer/background/mobile/primary'),
  color: cssVarV2('text/primary'),
});

export const surface = style({
  minHeight: 'calc(100dvh - 178px)',
  animation: `${surfaceIn} 260ms var(--manut-anim-curve-overshoot) both`,
  selectors: {
    '&[data-menu="chats"], &[data-menu="meetings"], &[data-menu="inbox"]': {
      padding: '18px 20px 112px',
    },
  },
  '@media': {
    '(prefers-reduced-motion: reduce)': {
      animation: 'none',
    },
  },
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

export const askAiOverlay = style({
  position: 'fixed',
  inset: 0,
  zIndex: 20,
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'center',
  background: 'rgba(0, 0, 0, 0.24)',
});

export const askAiSheet = style({
  width: '100%',
  minHeight: 'calc(100dvh - 88px)',
  maxHeight: 'calc(100dvh - 32px)',
  display: 'flex',
  flexDirection: 'column',
  borderTopLeftRadius: 28,
  borderTopRightRadius: 28,
  background: cssVarV2('layer/background/mobile/primary'),
  color: cssVarV2('text/primary'),
  boxShadow: '0 -18px 52px rgba(0, 0, 0, 0.24)',
  overflow: 'hidden',
});

export const askAiSheetHeader = style({
  position: 'relative',
  minHeight: 112,
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  padding: '28px 24px 0',
  flexShrink: 0,
});

export const askAiSheetIconButton = style({
  width: 56,
  height: 56,
  borderRadius: '50%',
  border: 0,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: cssVarV2('icon/secondary'),
  background: cssVarV2('layer/background/mobile/secondary'),
  boxShadow: '0 12px 28px rgba(0, 0, 0, 0.08)',
});

export const askAiSheetIdentity = style({
  position: 'absolute',
  left: '50%',
  top: 22,
  transform: 'translateX(-50%)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 8,
});

export const askAiSheetAvatar = style({
  width: 76,
  height: 76,
  borderRadius: '50%',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: cssVarV2('text/primary'),
  background: cssVarV2('layer/background/mobile/primary'),
  border: `1px solid ${cssVarV2('layer/insideBorder/border')}`,
  boxShadow: '0 14px 34px rgba(0, 0, 0, 0.16)',
});

export const askAiSheetTitle = style({
  maxWidth: 160,
  borderRadius: 18,
  padding: '5px 14px',
  fontSize: 20,
  lineHeight: '26px',
  fontWeight: 650,
  letterSpacing: 0,
  background: 'var(--manut-surface-glass-strong)',
  backdropFilter: 'blur(18px)',
  WebkitBackdropFilter: 'blur(18px)',
  boxShadow: '0 10px 30px rgba(0, 0, 0, 0.10)',
  whiteSpace: 'nowrap',
});

export const askAiSheetBody = style({
  flex: 1,
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  padding: '0 8px calc(env(safe-area-inset-bottom) + 12px)',
});

globalStyle(`${askAiSheetBody} > ai-chat-content`, {
  flex: '1 1 auto',
  minHeight: 0,
  width: '100%',
  height: '100%',
});

globalStyle(`${askAiSheetBody} chat-panel-split-view`, {
  minHeight: 0,
});

export const emptySurface = style({
  minHeight: 'calc(100dvh - 260px)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
  textAlign: 'center',
  color: cssVarV2('text/secondary'),
});

export const emptySurfaceIcon = style({
  width: 44,
  height: 44,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 14,
  color: cssVarV2('icon/secondary'),
  fontSize: 30,
});

export const emptySurfaceTitle = style({
  margin: 0,
  color: cssVarV2('text/primary'),
  fontSize: 24,
  lineHeight: '30px',
  fontWeight: 700,
  letterSpacing: 0,
});

export const emptySurfaceCopy = style({
  maxWidth: 270,
  margin: 0,
  color: cssVarV2('text/secondary'),
  fontSize: 19,
  lineHeight: '28px',
  letterSpacing: 0,
});

export const emptySurfaceAction = style({
  marginTop: 8,
  border: 0,
  padding: '8px 12px',
  borderRadius: 12,
  background: 'transparent',
  color: cssVarV2('button/primary'),
  fontSize: 19,
  lineHeight: '26px',
  fontWeight: 650,
  letterSpacing: 0,
  transition:
    'transform 150ms var(--manut-anim-curve-overshoot), background-color 150ms ease-out',
  selectors: {
    '&:active': {
      transform: 'scale(0.96)',
      background: cssVarV2('layer/background/mobile/secondary'),
    },
  },
});

export const menuSection = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 24,
  color: cssVarV2('text/primary'),
});

export const menuGroup = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
});

export const menuGroupTitle = style({
  color: cssVarV2('text/secondary'),
  fontSize: 18,
  lineHeight: '24px',
  fontWeight: 600,
  letterSpacing: 0,
});

export const menuRow = style({
  width: '100%',
  minHeight: 44,
  border: 0,
  padding: 0,
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  background: 'transparent',
  color: cssVarV2('text/primary'),
  textAlign: 'left',
  fontFamily: 'inherit',
  fontSize: 21,
  lineHeight: '28px',
  fontWeight: 560,
  letterSpacing: 0,
  transition:
    'transform 160ms var(--manut-anim-curve-overshoot), color 160ms ease-out',
  selectors: {
    '&:active': {
      transform: 'translateX(2px) scale(0.99)',
      color: cssVarV2('button/primary'),
    },
  },
});

export const menuRowIcon = style({
  width: 28,
  height: 28,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  color: cssVarV2('icon/secondary'),
  fontSize: 24,
});
