import { style } from '@vanilla-extract/css';

/**
 * The panel is always mounted (so the slide-in transition can run) but
 * translated offscreen + `inert` when no node is selected. See the JSX in
 * `node-detail-panel.tsx` for the inert/aria-hidden wiring.
 *
 * Backdrop blur sells a "frosted glass" overlay over the starfield; we keep
 * it dark regardless of theme because the graph background is space-black on
 * both themes (the nebula + nodes are the only theme-tinted layer).
 */
export const root = style({
  position: 'absolute',
  top: 0,
  right: 0,
  bottom: 0,
  width: 320,
  background: 'rgba(20, 20, 30, 0.72)',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
  borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
  padding: 20,
  boxSizing: 'border-box',
  color: 'rgba(255, 255, 255, 0.92)',
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  transition: 'transform 240ms ease',
  overflowY: 'auto',
});

export const rootOpen = style({
  transform: 'translateX(0)',
  pointerEvents: 'auto',
});

export const rootClosed = style({
  transform: 'translateX(100%)',
  pointerEvents: 'none',
});

export const header = style({
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 12,
});

export const titleButton = style({
  flex: '1 1 auto',
  background: 'transparent',
  border: 'none',
  padding: 0,
  fontSize: 18,
  fontWeight: 700,
  color: '#fff',
  lineHeight: 1.3,
  wordBreak: 'break-word',
  textAlign: 'left',
  cursor: 'pointer',
  ':hover': {
    textDecoration: 'underline',
  },
  ':focus-visible': {
    outline: '2px solid rgba(255, 255, 255, 0.6)',
    outlineOffset: 2,
    borderRadius: 4,
  },
});

export const closeButton = style({
  flex: '0 0 auto',
  width: 28,
  height: 28,
  borderRadius: 6,
  background: 'transparent',
  border: 'none',
  color: 'rgba(255, 255, 255, 0.7)',
  fontSize: 18,
  lineHeight: 1,
  cursor: 'pointer',
  padding: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  ':hover': {
    background: 'rgba(255, 255, 255, 0.08)',
    color: 'rgba(255, 255, 255, 0.95)',
  },
});

export const metaRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  fontSize: 12,
  color: 'rgba(255, 255, 255, 0.7)',
});

export const colourSwatch = style({
  width: 14,
  height: 14,
  borderRadius: '50%',
  flex: '0 0 auto',
  boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.18) inset',
});

export const clusterBadge = style({
  fontSize: 11,
  fontWeight: 500,
  padding: '3px 8px',
  borderRadius: 999,
  background: 'rgba(255, 255, 255, 0.08)',
  color: 'rgba(255, 255, 255, 0.85)',
  whiteSpace: 'nowrap',
});

export const sectionTitle = style({
  fontSize: 11,
  fontWeight: 600,
  color: 'rgba(255, 255, 255, 0.55)',
  textTransform: 'uppercase',
  letterSpacing: 0.6,
  margin: 0,
});

export const linkList = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  margin: 0,
  padding: 0,
  listStyle: 'none',
});

export const linkButton = style({
  width: '100%',
  textAlign: 'left',
  background: 'transparent',
  border: 'none',
  padding: '6px 8px',
  borderRadius: 6,
  color: 'rgba(255, 255, 255, 0.85)',
  fontSize: 13,
  cursor: 'pointer',
  ':hover': {
    background: 'rgba(255, 255, 255, 0.08)',
    color: '#fff',
  },
  ':focus-visible': {
    outline: '2px solid rgba(255, 255, 255, 0.6)',
    outlineOffset: 2,
  },
});

export const emptyLine = style({
  fontSize: 12,
  color: 'rgba(255, 255, 255, 0.45)',
  fontStyle: 'italic',
  padding: '4px 0',
});

export const activityList = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  margin: 0,
  padding: 0,
  listStyle: 'none',
});

export const activityRow = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  padding: '6px 8px',
  borderRadius: 6,
  background: 'rgba(255, 255, 255, 0.04)',
});

export const activityHead = style({
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: 8,
  fontSize: 12,
  color: 'rgba(255, 255, 255, 0.85)',
});

export const activityTool = style({
  fontWeight: 600,
});

export const activityAgent = style({
  fontSize: 11,
  color: 'rgba(255, 255, 255, 0.6)',
});

export const activityTimestamp = style({
  fontSize: 11,
  fontVariantNumeric: 'tabular-nums',
  color: 'rgba(255, 255, 255, 0.5)',
  whiteSpace: 'nowrap',
});

export const buttonRow = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  marginTop: 'auto',
});

export const primaryButton = style({
  width: '100%',
  padding: '10px 14px',
  fontSize: 13,
  fontWeight: 600,
  color: '#0b0b14',
  background: 'rgba(255, 255, 255, 0.92)',
  border: 'none',
  borderRadius: 8,
  cursor: 'pointer',
  ':hover': {
    background: '#fff',
  },
});

export const secondaryButton = style({
  width: '100%',
  padding: '10px 14px',
  fontSize: 13,
  fontWeight: 500,
  color: 'rgba(255, 255, 255, 0.92)',
  background: 'rgba(255, 255, 255, 0.08)',
  border: '1px solid rgba(255, 255, 255, 0.14)',
  borderRadius: 8,
  cursor: 'pointer',
  ':hover': {
    background: 'rgba(255, 255, 255, 0.14)',
  },
});
