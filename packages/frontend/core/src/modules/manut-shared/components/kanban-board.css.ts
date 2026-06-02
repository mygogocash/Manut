import { cssVarV2 } from '@toeverything/theme/v2';
import { style } from '@vanilla-extract/css';

export const board = style({
  display: 'grid',
  gridAutoFlow: 'column',
  gridAutoColumns: 'minmax(260px, 1fr)',
  gap: 12,
  overflowX: 'auto',
  paddingBottom: 8,
  alignItems: 'flex-start',
  '@media': {
    'screen and (max-width: 640px)': {
      gridAutoColumns: 'minmax(220px, calc(100vw - 48px))',
    },
  },
});

export const column = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: 12,
  borderRadius: 8,
  border: `1px solid ${cssVarV2.layer.insideBorder.border}`,
  background: cssVarV2.layer.background.secondary,
  minHeight: 200,
  selectors: {
    '&[data-drag-over="true"]': {
      borderColor: cssVarV2.layer.insideBorder.blackBorder,
      background: cssVarV2.layer.background.primary,
    },
  },
});

export const columnHeader = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  paddingBottom: 4,
});

export const columnLabel = style({
  fontSize: 12,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: 0.4,
  color: cssVarV2.text.secondary,
});

export const columnMeta = style({
  fontSize: 11,
  color: cssVarV2.text.secondary,
  whiteSpace: 'nowrap',
});

export const cardList = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  minHeight: 60,
});

export const cardSlot = style({
  position: 'relative',
});

export const dropZone = style({
  height: 4,
  margin: '2px 0',
  borderRadius: 2,
  selectors: {
    '&[data-drop-active="true"]': {
      background: cssVarV2.layer.insideBorder.blackBorder,
    },
  },
});

export const card = style({
  padding: '10px 12px',
  borderRadius: 6,
  background: cssVarV2.layer.background.primary,
  border: `1px solid ${cssVarV2.layer.insideBorder.border}`,
  cursor: 'grab',
  userSelect: 'none',
  transition:
    'opacity 120ms ease-out, transform 200ms var(--manut-anim-curve-overshoot)',
  selectors: {
    '&[data-dragging="true"]': {
      opacity: 0.4,
      transform: 'rotate(-1.5deg) scale(1.02)',
      pointerEvents: 'none',
    },
    '&:active': {
      cursor: 'grabbing',
    },
  },
});

export const emptyColumn = style({
  fontSize: 11,
  color: cssVarV2.text.secondary,
  fontStyle: 'italic',
  padding: '6px 4px',
});
