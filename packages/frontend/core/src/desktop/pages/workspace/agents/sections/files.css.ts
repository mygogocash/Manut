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

export const dropzone = style({
  border: `1px dashed ${cssVarV2.layer.insideBorder.border}`,
  borderRadius: 8,
  padding: 16,
  textAlign: 'center',
  background: cssVarV2.layer.background.secondary,
  color: cssVarV2.text.secondary,
  fontSize: cssVar('fontXs'),
  cursor: 'pointer',
  transition:
    'background 120ms ease, border-color 120ms ease, background-color 100ms var(--manut-anim-curve-overshoot), color 100ms var(--manut-anim-curve-overshoot)',
  selectors: {
    '&:hover': {
      borderColor: cssVarV2.layer.insideBorder.primaryBorder,
      background: cssVarV2.layer.background.primary,
    },
    '&[data-dragging="true"]': {
      borderColor: cssVarV2.layer.insideBorder.primaryBorder,
      background: cssVarV2.layer.background.primary,
    },
  },
});

export const dropzoneHidden = style({
  display: 'none',
});

export const fileList = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  marginTop: 4,
});

export const fileItem = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 10px',
  borderRadius: 6,
  border: `1px solid ${cssVarV2.layer.insideBorder.border}`,
  background: cssVarV2.layer.background.primary,
});

export const fileItemIcon = style({
  fontSize: 16,
  color: cssVarV2.icon.secondary,
  flexShrink: 0,
});

export const fileItemName = style({
  flex: 1,
  fontSize: cssVar('fontSm'),
  color: cssVarV2.text.primary,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
});

export const fileItemSize = style({
  fontSize: cssVar('fontXs'),
  color: cssVarV2.text.tertiary,
  flexShrink: 0,
});
