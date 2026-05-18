// eslint-disable-next-line import-x/no-extraneous-dependencies
import { style } from '@vanilla-extract/css';

/**
 * Admin Plugin Manager styles. Tailwind utilities cover most layout in
 * this admin app — vanilla-extract here is reserved for the cells where
 * we want stable class names for tests and a few non-utility values
 * (monospace tweaks, grid templates).
 *
 * Per CLAUDE.md §6: `style({...})` MUST live in `.css.ts` files; never
 * call it from a .tsx file.
 */

export const page = style({
  padding: 16,
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
});

export const installCard = style({
  marginBottom: 8,
});

export const installForm = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  maxWidth: 480,
});

export const formField = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
});

export const pluginList = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
});

export const pluginCard = style({
  display: 'flex',
  flexDirection: 'column',
});

export const cardHeader = style({
  paddingBottom: 8,
});

export const cardTitleRow = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
});

export const cardTitle = style({
  fontSize: 16,
  fontWeight: 600,
});

export const detailRow = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  marginBottom: 10,
});

export const mono = style({
  fontFamily:
    'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", monospace',
  fontSize: 12,
  wordBreak: 'break-all',
});

export const pillRow = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: 4,
});

export const cardFooter = style({
  display: 'flex',
  gap: 8,
  paddingTop: 0,
});

export const errorBox = style({
  padding: '12px 16px',
  borderRadius: 6,
  background: 'rgba(220, 38, 38, 0.08)',
  color: 'rgb(185, 28, 28)',
  fontSize: 13,
});

export const emptyState = style({
  padding: 24,
  textAlign: 'center',
  fontSize: 13,
  color: 'rgba(0, 0, 0, 0.6)',
});

export const skeletonRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: 12,
});

export const skeletonSquare = style({
  width: 40,
  height: 40,
  borderRadius: 6,
});

export const skeletonBar = style({
  flex: 1,
  height: 24,
  borderRadius: 4,
});

export const capabilityGrantList = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
});

export const capabilityGrantRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: 6,
});
