// Motion tokens referenced as raw CSS variables to keep this `.css.ts`
// file leaf-pure (see CLAUDE.md §6 "vanilla-extract evaluates .css.ts
// files in a Node VM").
import { cssVar } from '@toeverything/theme';
import { cssVarV2 } from '@toeverything/theme/v2';
import { fallbackVar, style } from '@vanilla-extract/css';

import { levelIndent } from '../tree/node.css';

export const emptyChildren = style({
  fontSize: cssVar('fontSm'),
  color: cssVarV2('text/disable'),
  textAlign: 'left',
  userSelect: 'none',
  lineHeight: '22px',
  padding: '4px 0px',
  marginTop: 2,
  // 48 = node.paddingLeft + node.collapsable.width + node.icon.width + node.icon.marginRight
  //    = 4 + 16 + 20 + 8
  // to align with node's content
  paddingLeft: `calc(${fallbackVar(levelIndent, '20px')} + 48px)`,
  transition:
    'background-color var(--affine-anim-duration-fast) var(--manut-anim-curve-overshoot)',
  selectors: {
    '&[data-dragged-over="true"]': {
      background: cssVarV2('layer/background/hoverOverlay'),
      borderRadius: '4px',
    },
  },
});
