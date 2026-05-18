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

export const pillRow = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: 6,
});

export const pill = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '4px 10px',
  height: 28,
  borderRadius: 999,
  border: `1px solid ${cssVarV2.layer.insideBorder.border}`,
  background: cssVarV2.layer.background.primary,
  color: cssVarV2.text.secondary,
  fontSize: cssVar('fontXs'),
  cursor: 'pointer',
  userSelect: 'none',
  transition:
    'background 120ms ease, border-color 120ms ease, color 120ms ease, background-color 100ms var(--manut-anim-curve-overshoot)',
  selectors: {
    '&:hover': {
      borderColor: cssVarV2.layer.insideBorder.primaryBorder,
    },
    '&[data-selected="true"]': {
      background: cssVarV2.layer.background.tertiary,
      color: cssVarV2.text.primary,
      borderColor: cssVarV2.layer.insideBorder.primaryBorder,
    },
    '&[data-disabled="true"]': {
      cursor: 'not-allowed',
      opacity: 0.6,
    },
  },
});

export const checkMark = style({
  fontSize: 12,
  lineHeight: 1,
  color: cssVarV2.icon.primary,
});
