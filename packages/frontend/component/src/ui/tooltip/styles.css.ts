import { cssVar } from '@toeverything/theme';
import { cssVarV2 } from '@toeverything/theme/v2';
import { keyframes, style } from '@vanilla-extract/css';

import { animationToken } from '../../theme/animation';
import { manutGlass, manutRadius } from '../../theme/manut-tokens';

const tooltipFadeIn = keyframes({
  from: {
    opacity: 0,
    transform: 'translateY(4px)',
  },
  to: {
    opacity: 1,
    transform: 'translateY(0)',
  },
});

export const tooltipContent = style({
  backgroundColor: manutGlass.surfaceStrong,
  backdropFilter: manutGlass.backdropFilter,
  WebkitBackdropFilter: manutGlass.backdropFilter,
  color: cssVarV2('tooltips/foreground'),
  padding: '5px 12px',
  fontSize: cssVar('fontSm'),
  lineHeight: '22px',
  borderRadius: manutRadius.input,
  maxWidth: '280px',
  wordBreak: 'break-word',
  transformOrigin: 'var(--radix-tooltip-content-transform-origin)',
  animation: `${tooltipFadeIn} ${animationToken.durationBase} ${animationToken.curveDefault}`,
  willChange: 'transform, opacity',
  '@supports': {
    'not (backdrop-filter: blur(20px))': {
      backgroundColor: cssVarV2('tooltips/background'),
    },
  },
});

export const withShortcut = style({
  display: 'flex',
  gap: 10,
});
export const withShortcutContent = style({
  whiteSpace: 'nowrap',
  textOverflow: 'ellipsis',
  overflow: 'hidden',
});

export const shortcut = style({
  display: 'flex',
  alignItems: 'center',
  gap: 2,
});
export const command = style({
  background: cssVarV2('tooltips/secondaryBackground'),
  fontSize: cssVar('fontXs'),
  fontWeight: 400,
  lineHeight: '20px',
  height: 16,
  minWidth: 16,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0 4px',
  borderRadius: 4,
  selectors: {
    '&[data-length="1"]': {
      width: 16,
    },
  },
});
