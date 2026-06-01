import { bodyEmphasized } from '@toeverything/theme/typography';
import { cssVarV2 } from '@toeverything/theme/v2';
import { style } from '@vanilla-extract/css';

export const headerIcon = style({
  width: 24,
  height: 24,
  color: cssVarV2('icon/primary'),
  flexShrink: 0,
});

export const headerTitle = style([
  bodyEmphasized,
  {
    color: cssVarV2('text/primary'),
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
]);
