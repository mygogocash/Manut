import { cssVarV2 } from '@toeverything/theme/v2';
import { style } from '@vanilla-extract/css';

// Use design tokens so the badge respects theme switches (light / dark).
// `button/primary` matches the rest of the workspace's primary-action surface.
//
// vanilla-extract requires `style()` to be called from a `.css.ts` file —
// hoisting from `index.tsx` here was needed to fix a runtime "Styles were
// unable to be assigned to a file" error that broke React mount during
// app bootstrap.
export const verifiedBadgeStyle = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  color: cssVarV2('button/primary'),
  fontSize: 12,
  fontWeight: 500,
  lineHeight: '20px',
  backgroundColor: cssVarV2('layer/background/primary'),
  borderRadius: 4,
  padding: '2px 8px',
  flexShrink: 0,
});
