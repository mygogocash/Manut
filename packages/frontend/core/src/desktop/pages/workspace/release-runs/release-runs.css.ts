import { cssVarV2 } from '@toeverything/theme/v2';
import { style } from '@vanilla-extract/css';

export const root = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  padding: '16px 24px',
  width: '100%',
  maxWidth: 1080,
  margin: '0 auto',
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
  gap: 8,
});

export const runRow = style({
  display: 'flex',
  flexDirection: 'column',
  border: `1px solid ${cssVarV2.layer.insideBorder.border}`,
  borderRadius: 8,
  background: cssVarV2.layer.background.primary,
  overflow: 'hidden',
});

export const runRowHeader = style({
  display: 'grid',
  gridTemplateColumns:
    'auto minmax(80px, 0.7fr) minmax(100px, 0.6fr) minmax(0, 1.2fr) minmax(0, 0.8fr) minmax(0, 0.8fr) auto',
  alignItems: 'center',
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
});

export const statusBadge = style({
  display: 'inline-flex',
  alignItems: 'center',
  padding: '3px 10px',
  borderRadius: 10,
  fontSize: 11,
  lineHeight: '14px',
  fontWeight: 500,
  textTransform: 'capitalize',
  background: cssVarV2.layer.background.secondary,
  color: cssVarV2.text.secondary,
  border: `0.5px solid ${cssVarV2.layer.insideBorder.border}`,
  whiteSpace: 'nowrap',
});

export const statusBadgeSuccess = style({
  background: cssVarV2.status.success,
  color: cssVarV2.text.pureWhite,
});

export const statusBadgeFailure = style({
  background: cssVarV2.status.error,
  color: cssVarV2.text.pureWhite,
});

export const statusBadgePending = style({
  background: cssVarV2.layer.background.secondary,
  color: cssVarV2.text.secondary,
});

export const statusBadgeInProgress = style({
  background: cssVarV2.layer.background.secondary,
  color: cssVarV2.text.link,
});

export const versionCell = style({
  fontSize: 13,
  lineHeight: '18px',
  fontWeight: 500,
  color: cssVarV2.text.primary,
});

export const shaCell = style({
  fontFamily:
    'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", monospace',
  fontSize: 12,
  color: cssVarV2.text.link,
  textDecoration: 'none',
  selectors: {
    '&:hover': {
      textDecoration: 'underline',
    },
  },
});

export const imageTagCell = style({
  fontFamily:
    'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", monospace',
  fontSize: 11,
  color: cssVarV2.text.secondary,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const actorCell = style({
  fontSize: 12,
  color: cssVarV2.text.secondary,
});

export const ageCell = style({
  fontSize: 11,
  color: cssVarV2.text.secondary,
  whiteSpace: 'nowrap',
});

export const expandToggle = style({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 24,
  height: 24,
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  color: cssVarV2.text.secondary,
  fontSize: 13,
});

export const runRowBody = style({
  borderTop: `1px solid ${cssVarV2.layer.insideBorder.border}`,
  padding: '12px 16px 16px 16px',
  background: cssVarV2.layer.background.secondary,
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
});

export const bodySection = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
});

export const bodySectionTitle = style({
  fontSize: 11,
  lineHeight: '16px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: cssVarV2.text.secondary,
});

export const taskList = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  margin: 0,
  padding: 0,
  listStyle: 'none',
});

export const taskItem = style({
  display: 'flex',
  alignItems: 'baseline',
  gap: 8,
  padding: '4px 0',
  fontSize: 12,
  lineHeight: '18px',
  color: cssVarV2.text.primary,
});

export const taskSlug = style({
  fontFamily:
    'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", monospace',
  fontSize: 11,
  color: cssVarV2.text.secondary,
  minWidth: 100,
});

export const evidenceList = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: 12,
});

export const evidenceLink = style({
  fontSize: 12,
  lineHeight: '18px',
  color: cssVarV2.text.link,
  textDecoration: 'none',
  selectors: {
    '&:hover': {
      textDecoration: 'underline',
    },
  },
});

export const evidenceLinkMuted = style({
  fontSize: 12,
  lineHeight: '18px',
  color: cssVarV2.text.secondary,
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
  gap: 8,
});

export const headerLeft = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 14,
  fontWeight: 500,
});
