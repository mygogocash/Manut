import { cssVar } from '@toeverything/theme';
import { createVar, keyframes, style } from '@vanilla-extract/css';

import { manutGlass, manutRadius } from '../../../theme/manut-tokens';
import {
  cardBorderColor,
  cardColor,
  cardForeground,
  iconColor,
} from '../desktop/styles.css';

const expandIn = keyframes({
  from: {
    maxWidth: 44,
  },
  to: {
    maxWidth: '100vw',
  },
});
export const sonner = style({
  vars: {
    '--mobile-offset-left': '0px !important',
    '--mobile-offset-right': '0px !important',
  },
});

// Local CSS var so we can fall back to the legacy opaque `cardColor`
// surface under `@supports not (backdrop-filter)` without losing
// contrast on browsers that can't render the glass blur.
const toastSurface = createVar('toastSurface');

export const toastRoot = style({
  vars: {
    [toastSurface]: manutGlass.surfaceStrong,
  },
  // Fallback to the opaque desktop card surface when backdrop-filter
  // is unsupported (legacy iOS Safari) — keeps the toast readable
  // without the blur context.
  '@supports': {
    'not (backdrop-filter: blur(1px))': {
      vars: {
        [toastSurface]: cardColor,
      },
    },
  },
  width: 'fit-content',
  minHeight: 44,
  // Align with Manut card radius (14) — the desktop notification card
  // adopted the same token in v1.12.x; keep mobile in lockstep.
  borderRadius: manutRadius.card,
  margin: '0px auto',
  padding: 10,
  backgroundColor: toastSurface,
  backdropFilter: manutGlass.backdropFilter,
  WebkitBackdropFilter: manutGlass.backdropFilter,
  color: cardForeground,
  border: `1px solid ${cardBorderColor}`,
  boxShadow: cssVar('shadow1'),

  display: 'flex',
  gap: 8,
  alignItems: 'center',

  overflow: 'hidden',
  transition: 'transform 0.1s',

  ':active': {
    transform: 'scale(0.97)',
  },

  selectors: {
    '&[data-animated="true"]': {
      // sooner will apply the animation when leaving, hide it
      visibility: 'hidden',
    },
    '&[data-animated="false"]': {
      maxWidth: 44,
      animation: `${expandIn} 0.8s cubic-bezier(.27,.28,.13,.99)`,
      animationFillMode: 'forwards',
    },
  },
});

export const toastIcon = style({
  fontSize: 24,
  lineHeight: 0,
  color: iconColor,
});

export const toastLabel = style({
  fontSize: 17,
  fontWeight: 400,
  lineHeight: '22px',
  letterSpacing: -0.43,
  whiteSpace: 'nowrap',
});

export const detailRoot = style({
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'start',
  padding: 16,
  zIndex: 9999,
  background: 'rgba(0,0,0,0.1)',
});
export const detailCard = style({
  // backgroundColor: cardColor,
  // color: cardForeground,
});
export const detailHeader = style({
  padding: '0 20px',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
});
export const detailContent = style({
  padding: '0 20px',
  marginTop: 8,
});
export const detailIcon = style([toastIcon, {}]);
export const detailLabel = style([
  toastLabel,
  {
    width: 0,
    flex: 1,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
]);
export const detailActions = style({
  display: 'flex',
  flexDirection: 'column',
});
