import { cssVarV2 } from '@toeverything/theme/v2';
import { style } from '@vanilla-extract/css';

export const root = style({
  display: 'flex',
  flexDirection: 'column',
  padding: '12px 16px',
  gap: '12px',
});

export const heading = style({
  fontSize: '13px',
  fontWeight: 600,
  color: cssVarV2('text/secondary'),
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
});

export const list = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
});

export const row = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '8px',
  padding: '8px 10px',
  borderRadius: '6px',
  border: `1px solid ${cssVarV2('layer/insideBorder/border')}`,
  background: cssVarV2('layer/background/primary'),
  transition: 'background-color 0.15s ease',
  ':hover': {
    background: cssVarV2('layer/background/hoverOverlay'),
  },
});

export const rowMain = style({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  flex: 1,
  minWidth: 0,
});

export const rowTitle = style({
  fontSize: '13px',
  color: cssVarV2('text/primary'),
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
});

export const rowScore = style({
  fontSize: '11px',
  color: cssVarV2('text/tertiary'),
  fontVariantNumeric: 'tabular-nums',
  flexShrink: 0,
});

export const rowLinkBtn = style({
  fontSize: '12px',
  color: cssVarV2('text/link'),
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  padding: '4px 8px',
  borderRadius: '4px',
  ':hover': {
    background: cssVarV2('layer/background/hoverOverlay'),
  },
  ':disabled': {
    color: cssVarV2('text/disable'),
    cursor: 'default',
  },
});

export const empty = style({
  fontSize: '12px',
  color: cssVarV2('text/tertiary'),
  textAlign: 'center',
  padding: '16px 0',
});

export const error = style({
  fontSize: '12px',
  color: cssVarV2('status/error'),
  padding: '8px 0',
});
