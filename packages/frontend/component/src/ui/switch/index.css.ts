import { cssVar } from '@toeverything/theme';
import { createVar, style } from '@vanilla-extract/css';

import { animationToken } from '../../theme/animation';

export const switchHeightVar = createVar('switchSize');
export const switchPaddingVar = createVar('switchPadding');
const switchWidthVar = createVar('switchWidth');
const dotSizeVar = createVar('dotSize');

export const labelStyle = style({
  vars: {
    [switchHeightVar]: '26px',
    [switchPaddingVar]: '3px',
    [switchWidthVar]: `calc((${switchHeightVar} - ${switchPaddingVar}) * 2)`,
    [dotSizeVar]: `calc(${switchHeightVar} - ${switchPaddingVar} * 2)`,
  },
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  cursor: 'pointer',
});
export const inputStyle = style({
  opacity: 0,
  position: 'absolute',
});
export const switchStyle = style({
  position: 'relative',
  height: switchHeightVar,
  width: switchWidthVar,
  background: cssVar('toggleDisableBackgroundColor'),
  borderRadius: '37px',
  transition: `background-color ${animationToken.durationBase} ${animationToken.curveDefault}`,
  selectors: {
    '&:before': {
      transition: `transform ${animationToken.durationBase} ${animationToken.curveDefault}, border-color ${animationToken.durationBase} ${animationToken.curveDefault}`,
      content: '""',
      position: 'absolute',
      width: dotSizeVar,
      height: dotSizeVar,
      borderRadius: '50%',
      top: '50%',
      background: cssVar('toggleCircleBackgroundColor'),
      transform: `translate(${switchPaddingVar}, -50%)`,
      willChange: 'transform',
    },
  },
});
export const switchCheckedStyle = style({
  background: cssVar('primaryColor'),
  selectors: {
    '&:before': {
      borderColor: cssVar('pureBlack10'),
      transform: `translate(calc(${switchHeightVar} - ${switchPaddingVar}), -50%)`,
    },
  },
});
export const switchDisabledStyle = style({
  cursor: 'not-allowed',
  opacity: 0.5,
});
