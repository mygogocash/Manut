// Motion tokens referenced as raw CSS variables to keep this `.css.ts`
// file leaf-pure (see CLAUDE.md §6 "vanilla-extract evaluates .css.ts
// files in a Node VM").
import { cssVar } from '@toeverything/theme';
import { style } from '@vanilla-extract/css';

export const draggedOverHighlight = style({
  transition:
    'background-color var(--affine-anim-duration-fast) var(--manut-anim-curve-overshoot)',
  selectors: {
    '&[data-dragged-over="true"]': {
      background: cssVar('--affine-hover-color'),
      borderRadius: '4px',
    },
  },
});
