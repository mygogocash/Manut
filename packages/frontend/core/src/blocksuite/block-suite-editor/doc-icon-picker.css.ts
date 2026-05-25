import { cssVarV2 } from '@toeverything/theme/v2';
import { globalStyle, style, type StyleRule } from '@vanilla-extract/css';

export const docIconPickerTriggerAlignmentStyle = {
  justifyContent: 'flex-start',
  padding: 0,
  textAlign: 'left',
} satisfies StyleRule;
export const docIconPickerTrigger = style({
  ...docIconPickerTriggerAlignmentStyle,
  width: 64,
  height: 64,
  selectors: {
    '&&': docIconPickerTriggerAlignmentStyle,
    '&[data-icon-type="emoji"], &[data-icon-type="affine-icon"]': {
      fontSize: 60,
      lineHeight: 1,
    },
    '&[data-icon-type="emoji"]': {
      fontFamily: 'Inter',
    },
    '&::after': {
      display: 'none',
    },
  },
});

export const placeholder = style({
  padding: '4px',
});
export const placeholderContent = style({
  display: 'flex',
  alignItems: 'center',
  gap: 4,
});
export const placeholderContentIcon = style({
  color: cssVarV2.icon.secondary,
  fontSize: 16,
});
export const placeholderContentText = style({
  color: cssVarV2.text.secondary,
  fontSize: 12,
});

globalStyle('.doc-icon-container[data-has-icon="false"]', {
  '@media': {
    print: {
      display: 'none',
    },
  },
});
