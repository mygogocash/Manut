import { cssVarV2 } from '@toeverything/theme/v2';
import { style } from '@vanilla-extract/css';

export const root = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  padding: '16px 24px',
  width: '100%',
  maxWidth: 960,
  margin: '0 auto',
  '@media': {
    'screen and (max-width: 640px)': {
      padding: '12px 16px',
      maxWidth: '100%',
    },
  },
});

export const toolbar = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  '@media': {
    'screen and (max-width: 640px)': {
      alignItems: 'stretch',
      flexDirection: 'column',
    },
  },
});

export const titleBlock = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
});

export const title = style({
  fontSize: 18,
  lineHeight: '24px',
  fontWeight: 600,
  color: cssVarV2.text.primary,
});

export const subtitle = style({
  fontSize: 12,
  lineHeight: '18px',
  color: cssVarV2.text.secondary,
});

export const list = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
});

export const listToolbar = style({
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 8,
  '@media': {
    'screen and (max-width: 640px)': {
      justifyContent: 'flex-start',
    },
  },
});

export const card = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 0,
  border: `1px solid ${cssVarV2.layer.insideBorder.border}`,
  borderRadius: 8,
  background: cssVarV2.layer.background.primary,
  overflow: 'hidden',
});

export const cardHeader = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  padding: '12px 16px',
  cursor: 'pointer',
  userSelect: 'none',
  transition:
    'background-color 100ms var(--manut-anim-curve-overshoot), background 100ms var(--manut-anim-curve-overshoot), color 100ms var(--manut-anim-curve-overshoot)',
  selectors: {
    '&:hover': {
      background: cssVarV2.layer.background.secondary,
    },
  },
  '@media': {
    'screen and (max-width: 640px)': {
      alignItems: 'flex-start',
      flexDirection: 'column',
    },
  },
});

export const cardHeaderInfo = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  flex: 1,
  minWidth: 0,
});

export const cardHeaderTitleRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  minWidth: 0,
  '@media': {
    'screen and (max-width: 640px)': {
      flexWrap: 'wrap',
    },
  },
});

export const cardName = style({
  fontSize: 14,
  lineHeight: '20px',
  fontWeight: 500,
  color: cssVarV2.text.primary,
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
});

export const cardDescription = style({
  fontSize: 12,
  lineHeight: '18px',
  color: cssVarV2.text.secondary,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const cardActions = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  '@media': {
    'screen and (max-width: 640px)': {
      justifyContent: 'flex-end',
      width: '100%',
    },
  },
});

export const taskCount = style({
  fontSize: 12,
  lineHeight: '18px',
  color: cssVarV2.text.secondary,
});

export const statusBadge = style({
  display: 'inline-flex',
  alignItems: 'center',
  padding: '2px 8px',
  borderRadius: 10,
  fontSize: 11,
  lineHeight: '16px',
  fontWeight: 500,
  background: cssVarV2.layer.background.secondary,
  color: cssVarV2.text.secondary,
  border: `0.5px solid ${cssVarV2.layer.insideBorder.border}`,
});

export const statusBadgeActive = style({
  background: cssVarV2.status.success,
  color: cssVarV2.text.pureWhite,
});

export const cardBody = style({
  borderTop: `1px solid ${cssVarV2.layer.insideBorder.border}`,
  padding: '12px 16px',
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
});

export const taskList = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
});

export const taskRow = style({
  display: 'grid',
  gridTemplateColumns: '1fr auto auto auto auto',
  alignItems: 'center',
  gap: 8,
  padding: '8px 10px',
  borderRadius: 6,
  border: `1px solid ${cssVarV2.layer.insideBorder.border}`,
  background: cssVarV2.layer.background.primary,
  '@media': {
    'screen and (max-width: 640px)': {
      alignItems: 'stretch',
      display: 'flex',
      flexDirection: 'column',
    },
  },
});

export const taskTitle = style({
  fontSize: 13,
  lineHeight: '18px',
  color: cssVarV2.text.primary,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  '@media': {
    'screen and (max-width: 640px)': {
      whiteSpace: 'normal',
    },
  },
});

export const taskTitleDone = style({
  textDecoration: 'line-through',
  color: cssVarV2.text.secondary,
});

export const taskMeta = style({
  fontSize: 11,
  lineHeight: '16px',
  color: cssVarV2.text.secondary,
  whiteSpace: 'nowrap',
  '@media': {
    'screen and (max-width: 640px)': {
      whiteSpace: 'normal',
    },
  },
});

export const taskFooterRow = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  '@media': {
    'screen and (max-width: 640px)': {
      alignItems: 'stretch',
      flexDirection: 'column',
    },
  },
});

export const taskFooterActions = style({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: 8,
  flexWrap: 'wrap',
  '@media': {
    'screen and (max-width: 640px)': {
      justifyContent: 'flex-start',
      width: '100%',
    },
  },
});

export const emptyState = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  padding: '48px 24px',
  textAlign: 'center',
  border: `1px dashed ${cssVarV2.layer.insideBorder.border}`,
  borderRadius: 8,
  color: cssVarV2.text.secondary,
  '@media': {
    'screen and (max-width: 640px)': {
      padding: '32px 16px',
    },
  },
});

export const emptyStateTitle = style({
  fontSize: 14,
  lineHeight: '20px',
  fontWeight: 500,
  color: cssVarV2.text.primary,
});

export const emptyStateBody = style({
  fontSize: 12,
  lineHeight: '18px',
  color: cssVarV2.text.secondary,
});

export const errorBox = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  padding: '12px 16px',
  borderRadius: 8,
  fontSize: 13,
  lineHeight: '18px',
  color: cssVarV2.status.error,
  background: cssVarV2.layer.background.error,
  '@media': {
    'screen and (max-width: 640px)': {
      alignItems: 'stretch',
      flexDirection: 'column',
    },
  },
});

export const skeletonRow = style({
  height: 56,
  borderRadius: 8,
  background: cssVarV2.layer.background.secondary,
  opacity: 0.6,
});

export const skeletonGroup = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
});

export const formGrid = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  paddingTop: 8,
});

export const fieldLabel = style({
  fontSize: 12,
  lineHeight: '18px',
  color: cssVarV2.text.secondary,
  fontWeight: 500,
});

export const fieldRow = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
});

export const fieldHorizontal = style({
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 8,
  '@media': {
    'screen and (max-width: 640px)': {
      gridTemplateColumns: '1fr',
    },
  },
});

export const formActions = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: 8,
  paddingTop: 12,
  '@media': {
    'screen and (max-width: 640px)': {
      flexWrap: 'wrap',
      justifyContent: 'flex-start',
    },
  },
});

export const formError = style({
  fontSize: 12,
  lineHeight: '18px',
  color: cssVarV2.status.error,
});

export const textarea = style({
  width: '100%',
  minHeight: 80,
  resize: 'vertical',
  border: `1px solid ${cssVarV2.layer.insideBorder.border}`,
  borderRadius: 6,
  padding: '8px 10px',
  fontSize: 13,
  lineHeight: '18px',
  color: cssVarV2.text.primary,
  background: cssVarV2.layer.background.primary,
  fontFamily: 'inherit',
  selectors: {
    '&:focus': {
      outline: `1px solid ${cssVarV2.layer.insideBorder.blackBorder}`,
    },
  },
});

export const select = style({
  width: '100%',
  height: 32,
  border: `1px solid ${cssVarV2.layer.insideBorder.border}`,
  borderRadius: 6,
  padding: '0 8px',
  fontSize: 13,
  lineHeight: '18px',
  color: cssVarV2.text.primary,
  background: cssVarV2.layer.background.primary,
  selectors: {
    '&:focus': {
      outline: `1px solid ${cssVarV2.layer.insideBorder.blackBorder}`,
    },
  },
});

export const inlineSelect = style({
  height: 26,
  fontSize: 11,
  border: `1px solid ${cssVarV2.layer.insideBorder.border}`,
  borderRadius: 4,
  padding: '0 6px',
  color: cssVarV2.text.primary,
  background: cssVarV2.layer.background.primary,
  '@media': {
    'screen and (max-width: 640px)': {
      width: '100%',
    },
  },
});

export const priorityNone = style({
  color: cssVarV2.text.secondary,
});
export const priorityLow = style({
  color: cssVarV2.text.secondary,
});
export const priorityMedium = style({
  color: cssVarV2.text.primary,
});
export const priorityHigh = style({
  color: cssVarV2.text.primary,
  fontWeight: 600,
});
export const priorityUrgent = style({
  color: cssVarV2.status.error,
  fontWeight: 600,
});

export const iconButton = style({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 26,
  height: 26,
  borderRadius: 4,
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  color: cssVarV2.text.secondary,
  transition:
    'background-color 100ms var(--manut-anim-curve-overshoot), background 100ms var(--manut-anim-curve-overshoot), color 100ms var(--manut-anim-curve-overshoot)',
  selectors: {
    '&:hover': {
      background: cssVarV2.layer.background.secondary,
      color: cssVarV2.text.primary,
    },
    '&:disabled': {
      cursor: 'not-allowed',
      opacity: 0.5,
    },
  },
  '@media': {
    'screen and (max-width: 640px)': {
      alignSelf: 'flex-end',
    },
  },
});

export const viewToggleGroup = style({
  display: 'inline-flex',
  gap: 4,
  padding: 2,
  borderRadius: 6,
  border: `1px solid ${cssVarV2.layer.insideBorder.border}`,
  background: cssVarV2.layer.background.secondary,
  '@media': {
    'screen and (max-width: 640px)': {
      display: 'flex',
      width: '100%',
    },
  },
});

export const viewToggleButton = style({
  padding: '4px 10px',
  fontSize: 12,
  lineHeight: '18px',
  border: 'none',
  borderRadius: 4,
  background: 'transparent',
  color: cssVarV2.text.secondary,
  cursor: 'pointer',
  '@media': {
    'screen and (max-width: 640px)': {
      flex: 1,
    },
  },
  selectors: {
    '&[data-active="true"]': {
      background: cssVarV2.layer.background.primary,
      color: cssVarV2.text.primary,
      fontWeight: 600,
    },
  },
});

export const kanbanCardTitle = style({
  fontSize: 13,
  lineHeight: '18px',
  fontWeight: 500,
  color: cssVarV2.text.primary,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
});

export const kanbanCardMetaRow = style({
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 6,
  marginTop: 6,
});

export const kanbanCardMeta = style({
  fontSize: 11,
  lineHeight: '14px',
  color: cssVarV2.text.secondary,
});

export const kanbanCardProject = style({
  fontSize: 11,
  lineHeight: '14px',
  color: cssVarV2.text.secondary,
  background: cssVarV2.layer.background.secondary,
  borderRadius: 4,
  padding: '1px 6px',
});

export const kanbanWrapper = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
});
