import { cssVar } from '@toeverything/theme';
import { style } from '@vanilla-extract/css';

export const backdrop = style({
  position: 'fixed',
  inset: 0,
  zIndex: 1000,
  pointerEvents: 'none',
});

export const tooltip = style({
  position: 'absolute',
  width: 320,
  maxWidth: 'calc(100vw - 32px)',
  padding: '16px 18px',
  borderRadius: 12,
  background: cssVar('backgroundOverlayPanelColor'),
  color: cssVar('textPrimaryColor'),
  boxShadow: cssVar('shadow3'),
  border: `1px solid ${cssVar('borderColor')}`,
  pointerEvents: 'auto',
  fontFamily: cssVar('fontFamily'),
});

export const arrow = style({
  position: 'absolute',
  width: 10,
  height: 10,
  background: cssVar('backgroundOverlayPanelColor'),
  borderRight: `1px solid ${cssVar('borderColor')}`,
  borderBottom: `1px solid ${cssVar('borderColor')}`,
  transform: 'rotate(45deg)',
});

export const title = style({
  fontSize: 14,
  fontWeight: 600,
  marginBottom: 6,
  lineHeight: 1.4,
});

export const body = style({
  fontSize: 13,
  lineHeight: 1.5,
  color: cssVar('textSecondaryColor'),
});

export const footer = style({
  marginTop: 14,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
});

export const progress = style({
  fontSize: 12,
  color: cssVar('textSecondaryColor'),
});

export const buttons = style({
  display: 'flex',
  gap: 8,
});

export const button = style({
  padding: '6px 12px',
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
  border: 'none',
  background: 'transparent',
  color: cssVar('textPrimaryColor'),
  selectors: {
    '&:hover': {
      background: cssVar('hoverColor'),
    },
  },
});

export const primaryButton = style([
  button,
  {
    background: cssVar('primaryColor'),
    color: cssVar('white'),
    selectors: {
      '&:hover': {
        background: cssVar('primaryColor'),
        opacity: 0.9,
      },
    },
  },
]);

export const highlightRing = style({
  position: 'absolute',
  borderRadius: 10,
  boxShadow: `0 0 0 3px ${cssVar('primaryColor')}, 0 0 0 6px rgba(0,0,0,0.1)`,
  pointerEvents: 'none',
  transition: 'all 0.2s ease',
});
