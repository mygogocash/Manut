import { cssVarV2 } from '@toeverything/theme/v2';
import { style } from '@vanilla-extract/css';

/**
 * M17 — CEO Chat page styles.
 *
 * CLAUDE.md scar: every `style({...})` MUST live in this `.css.ts`
 * file. Calling style() from a `.tsx` compiles but crashes at runtime,
 * killing the React mount silently (~3hr-debug scar).
 *
 * Layout: two-pane shell. Left rail lists conversations (~280px),
 * right pane shows turn thread + composer at the bottom.
 */

export const root = style({
  display: 'grid',
  gridTemplateColumns: '280px 1fr',
  gap: 0,
  height: '100%',
  minHeight: 0,
});

export const leftRail = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 0,
  borderRight: `1px solid ${cssVarV2.layer.insideBorder.border}`,
  background: cssVarV2.layer.background.secondary,
  overflowY: 'auto',
  minHeight: 0,
});

export const leftRailHeader = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 14px',
  borderBottom: `1px solid ${cssVarV2.layer.insideBorder.border}`,
  fontSize: 13,
  fontWeight: 600,
  color: cssVarV2.text.primary,
});

export const conversationList = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  padding: '8px 6px',
});

export const conversationItem = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 2,
  padding: '8px 10px',
  borderRadius: 6,
  background: 'transparent',
  color: cssVarV2.text.primary,
  cursor: 'pointer',
  textAlign: 'left',
  border: 'none',
  fontSize: 13,
  width: '100%',
  selectors: {
    '&:hover': {
      background: cssVarV2.layer.background.hoverOverlay,
    },
    '&[data-active="true"]': {
      background: cssVarV2.layer.background.tertiary,
    },
  },
});

export const conversationTitle = style({
  fontWeight: 500,
  whiteSpace: 'nowrap',
  textOverflow: 'ellipsis',
  overflow: 'hidden',
  maxWidth: '100%',
});

export const conversationMeta = style({
  fontSize: 11,
  color: cssVarV2.text.secondary,
});

export const newButton = style({
  fontSize: 11,
  padding: '4px 8px',
  borderRadius: 4,
  border: `1px solid ${cssVarV2.layer.insideBorder.border}`,
  background: cssVarV2.layer.background.primary,
  color: cssVarV2.text.primary,
  cursor: 'pointer',
  selectors: {
    '&:hover': {
      background: cssVarV2.layer.background.hoverOverlay,
    },
    '&:disabled': {
      opacity: 0.5,
      cursor: 'not-allowed',
    },
  },
});

export const rightPane = style({
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
  minWidth: 0,
});

export const thread = style({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  padding: '16px 24px',
  overflowY: 'auto',
  minHeight: 0,
});

export const emptyThread = style({
  margin: 'auto',
  textAlign: 'center',
  fontSize: 13,
  color: cssVarV2.text.secondary,
  maxWidth: 360,
});

export const turn = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  maxWidth: 720,
});

export const turnUser = style({
  alignSelf: 'flex-end',
});

export const turnAgent = style({
  alignSelf: 'flex-start',
});

export const turnRoleLabel = style({
  fontSize: 11,
  color: cssVarV2.text.secondary,
  letterSpacing: 0.4,
  textTransform: 'uppercase',
});

export const turnBody = style({
  padding: '10px 14px',
  borderRadius: 10,
  border: `1px solid ${cssVarV2.layer.insideBorder.border}`,
  background: cssVarV2.layer.background.primary,
  color: cssVarV2.text.primary,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  fontSize: 13,
  lineHeight: '20px',
  selectors: {
    [`${turnUser} &`]: {
      background: cssVarV2.layer.background.secondary,
    },
  },
});

export const resolutionRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 11,
  color: cssVarV2.text.secondary,
});

export const resolutionBadge = style({
  display: 'inline-flex',
  alignItems: 'center',
  padding: '2px 8px',
  borderRadius: 999,
  background: cssVarV2.layer.background.tertiary,
  color: cssVarV2.text.primary,
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: 0.2,
});

export const resolutionLink = style({
  fontSize: 11,
  color: cssVarV2.text.link,
  cursor: 'pointer',
  background: 'none',
  border: 'none',
  padding: 0,
  textDecoration: 'underline',
});

export const composer = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: '12px 24px 16px',
  borderTop: `1px solid ${cssVarV2.layer.insideBorder.border}`,
  background: cssVarV2.layer.background.primary,
});

export const composerTextarea = style({
  width: '100%',
  minHeight: 64,
  maxHeight: 240,
  resize: 'vertical',
  padding: '10px 12px',
  borderRadius: 8,
  border: `1px solid ${cssVarV2.layer.insideBorder.border}`,
  background: cssVarV2.layer.background.primary,
  color: cssVarV2.text.primary,
  fontSize: 13,
  lineHeight: '20px',
  fontFamily: 'inherit',
  outline: 'none',
  selectors: {
    '&:focus': {
      borderColor: cssVarV2.layer.insideBorder.primaryBorder,
    },
  },
});

export const composerActions = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: 8,
});

export const composerHint = style({
  fontSize: 11,
  color: cssVarV2.text.secondary,
  marginRight: 'auto',
});

export const errorBox = style({
  margin: '12px 24px',
  padding: '10px 12px',
  borderRadius: 6,
  border: `1px solid ${cssVarV2.status.error}`,
  background: cssVarV2.layer.background.primary,
  color: cssVarV2.status.error,
  fontSize: 12,
});
