import { cssVarV2 } from '@toeverything/theme/v2';
import { globalStyle, style } from '@vanilla-extract/css';

export const root = style({
  width: '100dvw',
  padding: '16px 20px 10px',
});

export const headerRow = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
});

export const workspaceChip = style({
  minWidth: 0,
  maxWidth: 'calc(100dvw - 160px)',
  height: 44,
  padding: '5px 13px 5px 7px',
  borderRadius: 22,
  border: `0.5px solid ${cssVarV2('layer/insideBorder/border')}`,
  background: cssVarV2('layer/background/mobile/secondary'),
  boxShadow: '0 4px 14px rgba(0, 0, 0, 0.08)',
});

globalStyle(`${workspaceChip} [data-testid="workspace-avatar"]`, {
  width: '32px',
  height: '32px',
});

globalStyle(`${workspaceChip} [class*="label"]`, {
  minWidth: 0,
  overflow: 'hidden',
  color: cssVarV2('text/primary'),
  fontSize: 18,
  fontWeight: 650,
  letterSpacing: 0,
  lineHeight: '24px',
  whiteSpace: 'nowrap',
  textOverflow: 'ellipsis',
});

export const headerActions = style({
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  flexShrink: 0,
});

export const roundAction = style({
  position: 'relative',
  width: 48,
  height: 48,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: `0.5px solid ${cssVarV2('layer/insideBorder/border')}`,
  borderRadius: '50%',
  padding: 0,
  background: cssVarV2('layer/background/mobile/secondary'),
  color: cssVarV2('icon/primary'),
  boxShadow: '0 4px 14px rgba(0, 0, 0, 0.08)',
  transition:
    'transform 120ms var(--manut-anim-curve-overshoot), background-color 120ms ease-out',
  selectors: {
    '&:active': {
      transform: 'scale(0.94)',
    },
  },
});

export const notificationBadge = style({
  position: 'absolute',
  top: -2,
  right: -2,
  backgroundColor: cssVarV2('button/primary'),
  color: cssVarV2('text/pureWhite'),
  minWidth: '16px',
  height: '16px',
  padding: '0 3px',
  lineHeight: '16px',
  borderRadius: '50%',
  textAlign: 'center',
  fontWeight: 700,
  boxSizing: 'border-box',
});
