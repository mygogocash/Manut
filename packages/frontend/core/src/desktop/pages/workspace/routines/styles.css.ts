import { cssVarV2 } from '@toeverything/theme/v2';
import { style } from '@vanilla-extract/css';

export const root = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  padding: '16px 24px 24px',
  height: '100%',
  overflow: 'auto',
});

export const toolbar = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
});

export const tabsList = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: 4,
  borderRadius: 8,
  background: cssVarV2.layer.background.secondary,
  border: `1px solid ${cssVarV2.layer.insideBorder.border}`,
});

export const tabButton = style({
  appearance: 'none',
  border: 'none',
  background: 'transparent',
  padding: '6px 12px',
  borderRadius: 6,
  fontSize: 13,
  lineHeight: '20px',
  fontWeight: 500,
  cursor: 'pointer',
  color: cssVarV2.text.secondary,
  transition:
    'background-color 100ms var(--manut-anim-curve-overshoot), color 100ms var(--manut-anim-curve-overshoot)',
  selectors: {
    '&[data-active="true"]': {
      background: cssVarV2.layer.background.primary,
      color: cssVarV2.text.primary,
      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.06)',
    },
    '&:hover:not([data-active="true"])': {
      color: cssVarV2.text.primary,
    },
  },
});

export const tabCount = style({
  marginLeft: 6,
  fontSize: 11,
  color: cssVarV2.text.tertiary,
});

export const list = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
});

export const card = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  padding: 12,
  border: `1px solid ${cssVarV2.layer.insideBorder.border}`,
  borderRadius: 8,
  background: cssVarV2.layer.background.primary,
});

export const cardHeader = style({
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 8,
});

export const cardTitleBlock = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  flex: 1,
  minWidth: 0,
});

export const cardTitle = style({
  fontSize: 14,
  lineHeight: '20px',
  fontWeight: 500,
  color: cssVarV2.text.primary,
  wordBreak: 'break-word',
});

export const cardDescription = style({
  fontSize: 12,
  lineHeight: '18px',
  color: cssVarV2.text.secondary,
  wordBreak: 'break-word',
});

export const cardMeta = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexWrap: 'wrap',
  fontSize: 12,
  lineHeight: '18px',
  color: cssVarV2.text.secondary,
});

export const cardPrompt = style({
  fontSize: 12,
  lineHeight: '18px',
  color: cssVarV2.text.secondary,
  fontFamily:
    'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  overflow: 'hidden',
  display: '-webkit-box',
  WebkitBoxOrient: 'vertical',
  WebkitLineClamp: 2,
  padding: '6px 8px',
  borderRadius: 4,
  background: cssVarV2.layer.background.secondary,
});

export const cardActions = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginTop: 4,
  flexWrap: 'wrap',
});

export const badge = style({
  display: 'inline-flex',
  alignItems: 'center',
  height: 18,
  padding: '0 8px',
  borderRadius: 9,
  fontSize: 11,
  lineHeight: '18px',
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: 0.3,
  border: `0.5px solid ${cssVarV2.layer.insideBorder.border}`,
  background: cssVarV2.layer.background.secondary,
  color: cssVarV2.text.secondary,
});

export const badgeActive = style({
  background: cssVarV2.layer.background.success,
  color: cssVarV2.status.success,
  borderColor: cssVarV2.status.success,
});

export const badgePaused = style({
  background: cssVarV2.layer.background.secondary,
  color: cssVarV2.text.secondary,
});

export const badgeError = style({
  background: cssVarV2.layer.background.error,
  color: cssVarV2.status.error,
  borderColor: cssVarV2.status.error,
});

export const badgeVisibility = style({
  display: 'inline-flex',
  alignItems: 'center',
  height: 18,
  padding: '0 8px',
  borderRadius: 9,
  fontSize: 11,
  lineHeight: '18px',
  fontWeight: 500,
  border: `0.5px solid ${cssVarV2.layer.insideBorder.border}`,
  background: cssVarV2.layer.background.secondary,
  color: cssVarV2.text.secondary,
});

export const skeleton = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
});

export const skeletonCard = style({
  height: 88,
  borderRadius: 8,
  background: cssVarV2.layer.background.secondary,
  border: `1px solid ${cssVarV2.layer.insideBorder.border}`,
  animation: 'pulse 1.5s ease-in-out infinite',
});

export const emptyState = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  padding: 40,
  border: `1px dashed ${cssVarV2.layer.insideBorder.border}`,
  borderRadius: 8,
  color: cssVarV2.text.secondary,
  fontSize: 13,
  lineHeight: '20px',
});

export const errorState = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 8,
  padding: 16,
  borderRadius: 8,
  background: cssVarV2.layer.background.error,
  color: cssVarV2.status.error,
  fontSize: 13,
  lineHeight: '20px',
});

export const modalBody = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  padding: '8px 0 16px',
});

export const fieldGroup = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
});

export const fieldLabel = style({
  fontSize: 12,
  lineHeight: '18px',
  fontWeight: 500,
  color: cssVarV2.text.primary,
});

export const fieldHint = style({
  fontSize: 11,
  lineHeight: '16px',
  color: cssVarV2.text.tertiary,
});

export const fieldError = style({
  color: cssVarV2.status.error,
  fontSize: 11,
  lineHeight: '16px',
});

export const textInput = style({
  width: '100%',
  height: 32,
  padding: '0 10px',
  borderRadius: 6,
  border: `1px solid ${cssVarV2.layer.insideBorder.border}`,
  background: cssVarV2.layer.background.primary,
  color: cssVarV2.text.primary,
  fontSize: 13,
  lineHeight: '20px',
  selectors: {
    '&:focus': {
      outline: `1px solid ${cssVarV2.layer.insideBorder.blackBorder}`,
    },
  },
});

export const textarea = style({
  width: '100%',
  minHeight: 96,
  resize: 'vertical',
  padding: '8px 10px',
  borderRadius: 6,
  border: `1px solid ${cssVarV2.layer.insideBorder.border}`,
  background: cssVarV2.layer.background.primary,
  color: cssVarV2.text.primary,
  fontSize: 13,
  lineHeight: '20px',
  fontFamily: 'inherit',
  selectors: {
    '&:focus': {
      outline: `1px solid ${cssVarV2.layer.insideBorder.blackBorder}`,
    },
  },
});

export const promptTextarea = style({
  width: '100%',
  minHeight: 140,
  resize: 'vertical',
  padding: '8px 10px',
  borderRadius: 6,
  border: `1px solid ${cssVarV2.layer.insideBorder.border}`,
  background: cssVarV2.layer.background.primary,
  color: cssVarV2.text.primary,
  fontSize: 13,
  lineHeight: '20px',
  fontFamily:
    'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
  selectors: {
    '&:focus': {
      outline: `1px solid ${cssVarV2.layer.insideBorder.blackBorder}`,
    },
  },
});

export const select = style({
  width: '100%',
  height: 32,
  padding: '0 8px',
  borderRadius: 6,
  border: `1px solid ${cssVarV2.layer.insideBorder.border}`,
  background: cssVarV2.layer.background.primary,
  color: cssVarV2.text.primary,
  fontSize: 13,
  lineHeight: '20px',
  selectors: {
    '&:focus': {
      outline: `1px solid ${cssVarV2.layer.insideBorder.blackBorder}`,
    },
  },
});

export const fieldRow = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 12,
});

export const modalActions = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: 8,
});

export const drawerHeader = style({
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 8,
  marginBottom: 12,
});

export const runList = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
});

export const runRow = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  padding: '8px 10px',
  borderRadius: 6,
  border: `1px solid ${cssVarV2.layer.insideBorder.border}`,
  background: cssVarV2.layer.background.primary,
  fontSize: 12,
  lineHeight: '18px',
});

export const runMeta = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  color: cssVarV2.text.secondary,
});

export const banner = style({
  padding: '8px 12px',
  borderRadius: 6,
  border: `1px dashed ${cssVarV2.layer.insideBorder.border}`,
  background: cssVarV2.layer.background.secondary,
  color: cssVarV2.text.secondary,
  fontSize: 12,
  lineHeight: '18px',
});
