import { cssVar } from '@toeverything/theme';
import { cssVarV2 } from '@toeverything/theme/v2';
import { style } from '@vanilla-extract/css';

export const section = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
});

export const sectionHeader = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
});

export const sectionTitle = style({
  fontSize: cssVar('fontSm'),
  fontWeight: 600,
  color: cssVarV2.text.primary,
  margin: 0,
});

export const sectionIcon = style({
  fontSize: 16,
  color: cssVarV2.icon.primary,
  display: 'inline-flex',
  alignItems: 'center',
});

export const sectionDescription = style({
  fontSize: cssVar('fontXs'),
  color: cssVarV2.text.secondary,
  margin: 0,
  marginBottom: 4,
  lineHeight: 1.5,
});

export const list = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
});

export const row = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 10px',
  borderRadius: 6,
  border: `1px solid ${cssVarV2.layer.insideBorder.border}`,
  background: cssVarV2.layer.background.primary,
  textAlign: 'left',
  cursor: 'pointer',
  color: cssVarV2.text.primary,
  fontSize: cssVar('fontSm'),
  transition:
    'border-color 120ms ease, background 120ms ease, background-color 100ms var(--manut-anim-curve-overshoot), color 100ms var(--manut-anim-curve-overshoot)',
  selectors: {
    '&:hover': {
      borderColor: cssVarV2.layer.insideBorder.primaryBorder,
      background: cssVarV2.layer.background.secondary,
    },
    '&:disabled': {
      cursor: 'not-allowed',
      opacity: 0.6,
    },
  },
});

export const rowIcon = style({
  fontSize: 16,
  color: cssVarV2.icon.secondary,
  flexShrink: 0,
});

export const rowName = style({
  flex: 1,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
});

export const addButton = style({
  alignSelf: 'flex-start',
  marginTop: 4,
});

export const empty = style({
  fontSize: cssVar('fontXs'),
  color: cssVarV2.text.tertiary,
  fontStyle: 'italic',
});
