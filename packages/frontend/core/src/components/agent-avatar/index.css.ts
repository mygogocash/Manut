import { cssVarV2 } from '@toeverything/theme/v2';
import { style } from '@vanilla-extract/css';

export const wrapper = style({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '50%',
  overflow: 'hidden',
  background: cssVarV2.layer.background.tertiary,
  flexShrink: 0,
  // The avatar SVG fills the wrapper.
  vars: {
    // Default size; overridden inline by the size prop.
  },
});

export const svg = style({
  width: '100%',
  height: '100%',
  display: 'block',
});
