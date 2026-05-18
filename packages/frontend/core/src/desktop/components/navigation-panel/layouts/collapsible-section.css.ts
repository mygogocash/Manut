// Motion tokens referenced as raw CSS variables to keep this `.css.ts`
// file leaf-pure (see CLAUDE.md §6 "vanilla-extract evaluates .css.ts
// files in a Node VM").
import { cssVarV2 } from '@toeverything/theme/v2';
import { style } from '@vanilla-extract/css';

export const root = style({});
export const content = style({
  paddingTop: 6,
});

export const header = style({
  transition:
    'background-color var(--affine-anim-duration-fast) var(--manut-anim-curve-overshoot)',
  selectors: {
    '&[data-dragged-over="true"]': {
      background: cssVarV2('layer/background/hoverOverlay'),
    },
  },
});
