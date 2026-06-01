import { cssVarV2 } from '@toeverything/theme/v2';
import { style } from '@vanilla-extract/css';

export const root = style({
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  minHeight: 0,
  padding: '12px 24px 24px',
  gap: 16,
});

export const tabsList = style({
  display: 'flex',
  gap: 8,
  borderBottom: `1px solid ${cssVarV2.layer.insideBorder.border}`,
});

export const tabsContent = style({
  flex: 1,
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
});

export const tabTrigger = style({
  padding: '8px 12px',
  fontSize: 14,
  background: 'transparent',
  border: 'none',
  borderBottom: '2px solid transparent',
  color: cssVarV2.text.secondary,
  cursor: 'pointer',
  selectors: {
    '&[data-state="active"]': {
      color: cssVarV2.text.primary,
      borderBottomColor: cssVarV2.text.primary,
      fontWeight: 600,
    },
  },
});

export const actionRow = style({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
  paddingTop: 8,
});

export const listWrapper = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  paddingTop: 12,
  overflowY: 'auto',
});

export const listRow = style({
  display: 'grid',
  gap: 12,
  gridTemplateColumns: '1fr auto',
  padding: '12px 16px',
  background: cssVarV2.layer.background.secondary,
  borderRadius: 8,
  border: `1px solid ${cssVarV2.layer.insideBorder.border}`,
});

export const rowTitle = style({
  fontSize: 14,
  fontWeight: 600,
  color: cssVarV2.text.primary,
});

export const rowSubtitle = style({
  fontSize: 12,
  color: cssVarV2.text.secondary,
  marginTop: 2,
});

export const rowMeta = style({
  fontSize: 12,
  color: cssVarV2.text.secondary,
  textAlign: 'right',
  alignSelf: 'center',
});

export const emptyState = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  padding: '48px 16px',
  color: cssVarV2.text.secondary,
  textAlign: 'center',
});

export const errorState = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 12,
  padding: '48px 16px',
  color: cssVarV2.status.error,
  textAlign: 'center',
});

export const formRow = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  marginBottom: 12,
});

export const formLabel = style({
  fontSize: 12,
  fontWeight: 500,
  color: cssVarV2.text.secondary,
});

export const selectButton = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
  padding: '8px 12px',
  border: `1px solid ${cssVarV2.layer.insideBorder.border}`,
  borderRadius: 6,
  background: cssVarV2.layer.background.primary,
  color: cssVarV2.text.primary,
  cursor: 'pointer',
  fontSize: 14,
});

export const formActions = style({
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 8,
  marginTop: 16,
});

export const sectionLabel = style({
  fontSize: 12,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: 0.4,
  color: cssVarV2.text.secondary,
  marginTop: 12,
});

export const groupedList = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
});

export const placeholderText = style({
  color: cssVarV2.text.secondary,
  fontSize: 13,
});

export const inlineHint = style({
  fontSize: 12,
  color: cssVarV2.text.secondary,
});

export const textarea = style({
  width: '100%',
  minHeight: 96,
  resize: 'vertical',
  border: `1px solid ${cssVarV2.layer.insideBorder.border}`,
  borderRadius: 6,
  padding: '8px 12px',
  fontSize: 14,
  lineHeight: '20px',
  color: cssVarV2.text.primary,
  background: cssVarV2.layer.background.primary,
  selectors: {
    '&:focus': {
      outline: `1px solid ${cssVarV2.layer.insideBorder.blackBorder}`,
    },
  },
});

// Clickable list rows. We don't use a real <button> because the row already
// contains rich content + a chevron, but we surface keyboard affordance via
// role="button" + tabIndex + Enter/Space handling on the caller side.
export const clickableRow = style({
  cursor: 'pointer',
  selectors: {
    '&:hover': {
      borderColor: cssVarV2.layer.insideBorder.blackBorder,
    },
    '&:focus-visible': {
      outline: `2px solid ${cssVarV2.layer.insideBorder.blackBorder}`,
      outlineOffset: 2,
    },
  },
});

// Detail panel — opens as a right-side drawer via Modal's `slideRight`
// animation. It's not a full peek view, just a focused side panel that
// shares the page's stacking context.
export const detailPanel = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  padding: '4px 0',
});

export const detailSection = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
});

export const detailLabel = style({
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: 0.4,
  color: cssVarV2.text.secondary,
});

export const detailValue = style({
  fontSize: 14,
  color: cssVarV2.text.primary,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
});

export const detailEmpty = style({
  fontSize: 14,
  color: cssVarV2.text.tertiary,
  fontStyle: 'italic',
});

export const detailHeader = style({
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 12,
  paddingBottom: 12,
  borderBottom: `1px solid ${cssVarV2.layer.insideBorder.border}`,
});

export const detailActions = style({
  display: 'flex',
  gap: 8,
  flexShrink: 0,
});

export const detailLinkedList = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  paddingTop: 4,
});

export const detailLinkedRow = style({
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: 8,
  fontSize: 13,
  color: cssVarV2.text.primary,
});

export const detailLinkedMeta = style({
  fontSize: 12,
  color: cssVarV2.text.secondary,
  flexShrink: 0,
});

export const dangerButton = style({
  selectors: {
    '&:not(:disabled)': {
      color: cssVarV2.status.error,
    },
  },
});

// Actionable contact email / phone / website links rendered in list rows.
export const contactLink = style({
  display: 'block',
  fontSize: 13,
  color: cssVarV2.text.link,
  textDecoration: 'none',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  selectors: {
    '&:hover': {
      textDecoration: 'underline',
    },
  },
});

// Actionable link used inside the detail panel field value slot.
export const detailLink = style({
  fontSize: 14,
  color: cssVarV2.text.link,
  textDecoration: 'none',
  wordBreak: 'break-word',
  selectors: {
    '&:hover': {
      textDecoration: 'underline',
    },
  },
});
