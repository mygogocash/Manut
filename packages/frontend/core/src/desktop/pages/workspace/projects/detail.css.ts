import { cssVar } from '@toeverything/theme';
import { cssVarV2 } from '@toeverything/theme/v2';
import { style } from '@vanilla-extract/css';

export const root = style({
  width: '100%',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  background: cssVarV2.layer.background.primary,
  overflow: 'hidden',
});

export const scroll = style({
  flex: 1,
  overflow: 'auto',
  padding: '24px 32px 64px 32px',
  '@media': {
    'screen and (max-width: 640px)': {
      padding: '16px 16px 56px',
    },
  },
});

export const inner = style({
  width: '100%',
  maxWidth: 960,
  marginLeft: 'auto',
  marginRight: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 24,
});

export const header = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  paddingBottom: 16,
  borderBottom: `1px solid ${cssVarV2.layer.insideBorder.border}`,
});

export const headerTopRow = style({
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 16,
  '@media': {
    'screen and (max-width: 640px)': {
      flexDirection: 'column',
    },
  },
});

export const headerInfo = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  flex: 1,
  minWidth: 0,
});

export const headerActions = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexShrink: 0,
  '@media': {
    'screen and (max-width: 640px)': {
      flexWrap: 'wrap',
      width: '100%',
    },
  },
});

export const titleRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  '@media': {
    'screen and (max-width: 640px)': {
      alignItems: 'flex-start',
      flexDirection: 'column',
    },
  },
});

export const nameInput = style({
  width: '100%',
  fontSize: 24,
  fontWeight: 600,
  color: cssVarV2.text.primary,
  background: 'transparent',
  border: 'none',
  outline: 'none',
  padding: '4px 0',
  fontFamily: 'inherit',
  borderBottom: '1px solid transparent',
  '@media': {
    'screen and (max-width: 640px)': {
      fontSize: 20,
      lineHeight: '28px',
    },
  },
  selectors: {
    '&:focus': {
      borderBottomColor: cssVarV2.layer.insideBorder.primaryBorder,
    },
    '&::placeholder': {
      color: cssVarV2.text.placeholder,
    },
  },
});

export const description = style({
  fontSize: cssVar('fontSm'),
  color: cssVarV2.text.secondary,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
});

export const descriptionEmpty = style({
  fontStyle: 'italic',
  color: cssVarV2.text.placeholder,
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

export const sections = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 24,
});

export const sectionTitle = style({
  fontSize: 14,
  lineHeight: '20px',
  fontWeight: 600,
  color: cssVarV2.text.primary,
});

export const sectionHeader = style({
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

export const loading = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '48px 24px',
  fontSize: cssVar('fontSm'),
  color: cssVarV2.text.secondary,
});

export const notFound = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  padding: '48px 24px',
  fontSize: cssVar('fontSm'),
  color: cssVarV2.text.secondary,
});

export const notFoundTitle = style({
  fontSize: cssVar('fontH5'),
  fontWeight: 600,
  color: cssVarV2.text.primary,
});

export const archiveBanner = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 12px',
  borderRadius: 6,
  background: cssVarV2.layer.background.secondary,
  color: cssVarV2.text.secondary,
  fontSize: 12,
  lineHeight: '18px',
});

export const taskMetaRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 11,
  lineHeight: '16px',
  color: cssVarV2.text.secondary,
  flexWrap: 'wrap',
});

export const taskRowClickable = style({
  cursor: 'pointer',
  transition:
    'background-color 100ms var(--manut-anim-curve-overshoot), background 100ms var(--manut-anim-curve-overshoot), color 100ms var(--manut-anim-curve-overshoot)',
  selectors: {
    '&:hover': {
      background: cssVarV2.layer.background.secondary,
    },
  },
});
