import { cssVar } from '@toeverything/theme';
import { style } from '@vanilla-extract/css';

// Shared styles for Meetings + Inbox sidebar views. Notion-style:
// header row → group label → tight rows → relative time on the right.
//
// Brand tokens (`--manut-*`) are referenced as raw CSS variables (not
// imported via the `@affine/component` package root) — vanilla-extract
// evaluates `.css.ts` in a Node VM, and importing the package root drags
// `HTMLElement`-touching siblings into the VM (CLAUDE.md §6 vanilla-
// extract scar).

export const viewRoot = style({
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
  flex: '1 1 auto',
});

// Header row: title + small action icons (read-all, archive, more).
export const viewHeader = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '10px 12px 6px',
  gap: 6,
  fontSize: 11,
  fontWeight: 500,
  color: cssVar('textSecondaryColor'),
  textTransform: 'uppercase',
  letterSpacing: 0.4,
});

export const viewHeaderActions = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 2,
});

export const headerActionButton = style({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 22,
  height: 22,
  border: 'none',
  background: 'transparent',
  color: cssVar('iconColor'),
  borderRadius: 'var(--manut-radius-input)',
  cursor: 'pointer',
  fontSize: 14,
  padding: 0,
  transition:
    'background var(--affine-anim-duration-fast) var(--affine-anim-curve-default), color var(--affine-anim-duration-fast) var(--affine-anim-curve-default)',
  selectors: {
    '&:hover': {
      background: cssVar('hoverColor'),
      color: cssVar('iconSecondary'),
    },
    '&:focus-visible': {
      outline: '2px solid var(--manut-accent-violet-fg)',
      outlineOffset: 1,
    },
    '&[disabled]': {
      cursor: 'not-allowed',
      opacity: 0.45,
    },
  },
});

// Scrollable list shell. The outer container lets the sidebar manage
// scrolling; we just stack groups inside.
export const viewBody = style({
  display: 'flex',
  flexDirection: 'column',
  padding: '0 4px 8px',
  gap: 2,
});

// Group label — Notion-style small caps section header.
export const groupLabel = style({
  padding: '8px 10px 2px',
  fontSize: 10,
  fontWeight: 600,
  color: cssVar('textSecondaryColor'),
  textTransform: 'uppercase',
  letterSpacing: 0.6,
});

// Row: icon/avatar + main content + timestamp on the right.
export const row = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 8px',
  borderRadius: 'var(--manut-radius-input)',
  cursor: 'pointer',
  color: cssVar('textPrimaryColor'),
  minHeight: 30,
  transition:
    'background var(--affine-anim-duration-fast) var(--affine-anim-curve-default)',
  selectors: {
    '&:hover': {
      background: cssVar('hoverColor'),
    },
    '&[data-active="true"]': {
      background: 'var(--manut-accent-violet-bg)',
      color: 'var(--manut-accent-violet-fg)',
    },
  },
});

export const rowIcon = style({
  flex: '0 0 auto',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 18,
  height: 18,
  color: cssVar('iconColor'),
  fontSize: 16,
});

// Colored dot — calendar's per-subscription accent.
export const rowDot = style({
  flex: '0 0 auto',
  width: 8,
  height: 8,
  borderRadius: '50%',
  background: 'var(--manut-accent-violet-fg)',
});

export const rowMain = style({
  flex: '1 1 auto',
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 1,
});

export const rowTitle = style({
  fontSize: 13,
  fontWeight: 500,
  color: cssVar('textPrimaryColor'),
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  lineHeight: 1.3,
});

export const rowSubtitle = style({
  fontSize: 11,
  fontWeight: 400,
  color: cssVar('textSecondaryColor'),
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  lineHeight: 1.3,
});

export const rowMeta = style({
  flex: '0 0 auto',
  fontSize: 11,
  color: cssVar('textSecondaryColor'),
  whiteSpace: 'nowrap',
});

// Notion-style avatar wrapper (used by Inbox).
export const rowAvatar = style({
  flex: '0 0 auto',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
});

// Empty state — used by Meetings before connect; mirrors the brand-violet
// icon plate the placeholder views used (visual consistency across tabs).
export const emptyState = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 12,
  padding: '32px 24px',
  textAlign: 'center',
  color: cssVar('textSecondaryColor'),
  minHeight: 240,
});

export const emptyIcon = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 48,
  height: 48,
  borderRadius: 'var(--manut-radius-card)',
  background: 'var(--manut-accent-violet-bg)',
  color: 'var(--manut-accent-violet-fg)',
  fontSize: 24,
});

export const emptyTitle = style({
  fontSize: 14,
  fontWeight: 600,
  color: cssVar('textPrimaryColor'),
});

export const emptyCopy = style({
  fontSize: 12,
  fontWeight: 400,
  color: cssVar('textSecondaryColor'),
  maxWidth: 220,
  lineHeight: 1.5,
});

export const emptyAction = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 12px',
  border: 'none',
  background: 'var(--manut-accent-violet-fg)',
  color: '#fff',
  borderRadius: 'var(--manut-radius-input)',
  fontSize: 12,
  fontWeight: 500,
  cursor: 'pointer',
  transition:
    'opacity var(--affine-anim-duration-fast) var(--affine-anim-curve-default)',
  selectors: {
    '&:hover': {
      opacity: 0.9,
    },
    '&:focus-visible': {
      outline: '2px solid var(--manut-accent-violet-fg)',
      outlineOffset: 2,
    },
  },
});

// Loading + error spacers — keep visual rhythm consistent with the row.
export const skeletonRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 8px',
  minHeight: 30,
  color: cssVar('textDisableColor'),
  fontSize: 12,
});

export const errorText = style({
  padding: '8px 12px',
  fontSize: 12,
  color: cssVar('errorColor'),
});
