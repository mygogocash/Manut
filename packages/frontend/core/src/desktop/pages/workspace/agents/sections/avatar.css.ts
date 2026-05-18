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

export const layout = style({
  display: 'flex',
  gap: 24,
  alignItems: 'flex-start',
  marginTop: 8,
  '@media': {
    'screen and (max-width: 720px)': {
      flexDirection: 'column',
      gap: 16,
    },
  },
});

export const previewColumn = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 12,
  flexShrink: 0,
});

export const preview = style({
  width: 160,
  height: 160,
  borderRadius: '50%',
  overflow: 'hidden',
  border: `1px solid ${cssVarV2.layer.insideBorder.border}`,
  background: cssVarV2.layer.background.secondary,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
});

export const previewActions = style({
  display: 'flex',
  gap: 6,
  flexWrap: 'wrap',
  justifyContent: 'center',
});

export const resetButton = style({
  fontSize: cssVar('fontXs'),
  color: cssVarV2.text.secondary,
  background: 'transparent',
  border: `1px solid ${cssVarV2.layer.insideBorder.border}`,
  borderRadius: 6,
  padding: '4px 10px',
  cursor: 'pointer',
  fontFamily: 'inherit',
  transition:
    'background-color 100ms var(--manut-anim-curve-overshoot), background 100ms var(--manut-anim-curve-overshoot), color 100ms var(--manut-anim-curve-overshoot)',
  selectors: {
    '&:hover': {
      background: cssVarV2.layer.background.tertiary,
    },
    '&:disabled': {
      opacity: 0.45,
      cursor: 'not-allowed',
    },
  },
});

// Primary-styled button for the shuffle action — subtle accent so it
// reads as the recommended/quick path next to the secondary "Reset".
export const shuffleButton = style({
  fontSize: cssVar('fontXs'),
  color: cssVarV2.button.primary,
  background: 'transparent',
  border: `1px solid ${cssVarV2.button.primary}`,
  borderRadius: 6,
  padding: '4px 10px',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontWeight: 500,
  transition:
    'background-color 100ms var(--manut-anim-curve-overshoot), background 100ms var(--manut-anim-curve-overshoot), color 100ms var(--manut-anim-curve-overshoot)',
  selectors: {
    '&:hover': {
      background: cssVarV2.layer.background.tertiary,
    },
    '&:disabled': {
      opacity: 0.45,
      cursor: 'not-allowed',
    },
  },
});

export const editorColumn = style({
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
});

export const tabBar = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: 4,
  padding: 4,
  borderRadius: 8,
  background: cssVarV2.layer.background.secondary,
  border: `1px solid ${cssVarV2.layer.insideBorder.border}`,
});

export const tabButton = style({
  flexShrink: 0,
  fontSize: cssVar('fontXs'),
  fontWeight: 500,
  color: cssVarV2.text.secondary,
  background: 'transparent',
  border: 'none',
  padding: '6px 10px',
  borderRadius: 6,
  cursor: 'pointer',
  fontFamily: 'inherit',
  transition:
    'background-color 100ms var(--manut-anim-curve-overshoot), background 100ms var(--manut-anim-curve-overshoot), color 100ms var(--manut-anim-curve-overshoot)',
  selectors: {
    '&:hover': {
      background: cssVarV2.layer.background.tertiary,
    },
    '&[data-active="true"]': {
      background: cssVarV2.layer.background.primary,
      color: cssVarV2.text.primary,
      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.06)',
    },
  },
});

export const optionGrid = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(64px, 1fr))',
  gap: 8,
  padding: 8,
  borderRadius: 8,
  background: cssVarV2.layer.background.secondary,
  border: `1px solid ${cssVarV2.layer.insideBorder.border}`,
  maxHeight: 360,
  overflowY: 'auto',
});

export const optionThumb = style({
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  aspectRatio: '1 / 1',
  borderRadius: 8,
  border: `1px solid ${cssVarV2.layer.insideBorder.border}`,
  background: cssVarV2.layer.background.primary,
  cursor: 'pointer',
  padding: 0,
  overflow: 'hidden',
  transition:
    'border-color 120ms ease, transform 120ms ease, background-color 100ms var(--manut-anim-curve-overshoot), color 100ms var(--manut-anim-curve-overshoot)',
  selectors: {
    '&:hover': {
      borderColor: cssVarV2.layer.insideBorder.primaryBorder,
    },
    '&[data-selected="true"]': {
      borderColor: cssVarV2.layer.insideBorder.primaryBorder,
      boxShadow: `0 0 0 2px ${cssVarV2.layer.insideBorder.primaryBorder}`,
    },
  },
});

export const optionThumbInner = style({
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  // Avataaars renders at 264x280; we let SVG scale into this box.
  pointerEvents: 'none',
});

export const optionLabel = style({
  fontSize: 10,
  color: cssVarV2.text.secondary,
  textAlign: 'center',
  marginTop: 2,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
});

export const swatchRow = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: 6,
  padding: 8,
  borderRadius: 8,
  background: cssVarV2.layer.background.secondary,
  border: `1px solid ${cssVarV2.layer.insideBorder.border}`,
});

export const swatchLabel = style({
  width: '100%',
  fontSize: cssVar('fontXs'),
  fontWeight: 500,
  color: cssVarV2.text.secondary,
  marginBottom: 4,
});

export const swatch = style({
  width: 24,
  height: 24,
  borderRadius: '50%',
  border: `2px solid transparent`,
  cursor: 'pointer',
  padding: 0,
  outline: 'none',
  flexShrink: 0,
  position: 'relative',
  selectors: {
    '&[data-selected="true"]': {
      borderColor: cssVarV2.layer.insideBorder.primaryBorder,
      boxShadow: `0 0 0 1px ${cssVarV2.layer.background.primary} inset`,
    },
    '&:hover': {
      transform: 'scale(1.08)',
    },
  },
});

export const swatchEmpty = style({
  width: 24,
  height: 24,
  borderRadius: '50%',
  border: `2px dashed ${cssVarV2.layer.insideBorder.border}`,
  cursor: 'pointer',
  padding: 0,
  background: 'transparent',
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 14,
  color: cssVarV2.text.secondary,
  selectors: {
    '&[data-selected="true"]': {
      borderColor: cssVarV2.layer.insideBorder.primaryBorder,
    },
  },
});
