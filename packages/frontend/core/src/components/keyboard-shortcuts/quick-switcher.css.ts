import { cssVar } from '@toeverything/theme';
import { style } from '@vanilla-extract/css';

/**
 * Quick switcher (Cmd+P) — recent docs list on the left, 3-line
 * preview on the right. Manut tokens used as raw CSS vars to avoid
 * pulling @affine/component package root into the vanilla-extract VM
 * (CLAUDE.md §6 scar).
 */

export const switcherRoot = style({
  display: 'flex',
  flexDirection: 'row',
  minHeight: 380,
  maxHeight: '70vh',
  borderRadius: 'var(--manut-radius-card, 14px)',
  overflow: 'hidden',
  background: cssVar('backgroundPrimaryColor'),
});

export const listColumn = style({
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  minWidth: 0,
  borderRight: `1px solid ${cssVar('dividerColor')}`,
});

export const list = style({
  flex: 1,
  overflow: 'auto',
  padding: '8px 0',
});

export const emptyState = style({
  padding: '24px',
  textAlign: 'center',
  fontSize: cssVar('fontSm'),
  color: cssVar('textSecondaryColor'),
});

export const row = style({
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '8px 14px',
  cursor: 'pointer',
  fontSize: cssVar('fontSm'),
  color: cssVar('textPrimaryColor'),
  selectors: {
    '&[data-selected="true"]': {
      background: 'var(--manut-accent-violet-bg, rgba(124, 58, 237, 0.08))',
      color: 'var(--manut-accent-violet-fg, #7c3aed)',
    },
    '&:hover': {
      background: cssVar('backgroundTertiaryColor'),
    },
  },
});

export const rowIcon = style({
  width: 16,
  height: 16,
  flexShrink: 0,
  color: cssVar('iconSecondary'),
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
});

export const rowTitle = style({
  flex: 1,
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const previewColumn = style({
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  minWidth: 0,
  maxWidth: 360,
  padding: '16px 20px',
  background: cssVar('backgroundPrimaryColor'),
  gap: 12,
  overflow: 'auto',
});

export const previewTitle = style({
  fontSize: cssVar('fontH6'),
  fontWeight: 600,
  color: cssVar('textPrimaryColor'),
  margin: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const previewMeta = style({
  fontSize: cssVar('fontXs'),
  color: cssVar('textSecondaryColor'),
});

export const previewBody = style({
  fontSize: cssVar('fontSm'),
  lineHeight: 1.6,
  color: cssVar('textPrimaryColor'),
  // Clamp to 3 lines — IMPLEMENTATION_PLAN.md §B11 requires a 3-line
  // preview pane. line-clamp is supported across modern Chromium,
  // Firefox, and Safari — no fallback needed for the desktop client.
  display: '-webkit-box',
  WebkitLineClamp: 3,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
});

export const previewEmpty = style({
  fontSize: cssVar('fontSm'),
  color: cssVar('textSecondaryColor'),
  fontStyle: 'italic',
});

export const previewHints = style({
  marginTop: 'auto',
  paddingTop: 12,
  borderTop: `1px solid ${cssVar('dividerColor')}`,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  fontSize: cssVar('fontXs'),
  color: cssVar('textSecondaryColor'),
});

export const previewHintRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: 6,
});

export const hintKey = style({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0 4px',
  minWidth: 18,
  height: 18,
  borderRadius: 'var(--manut-radius-chip, 4px)',
  background: cssVar('backgroundTertiaryColor'),
  fontSize: 10,
  fontFamily: 'inherit',
});

export const switcherInputWrap = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '14px 16px',
  borderBottom: `1px solid ${cssVar('dividerColor')}`,
  background: cssVar('backgroundPrimaryColor'),
});

export const switcherInput = style({
  flex: 1,
  border: 'none',
  outline: 'none',
  background: 'transparent',
  fontSize: cssVar('fontSm'),
  color: cssVar('textPrimaryColor'),
  selectors: {
    '&::placeholder': {
      color: cssVar('textSecondaryColor'),
    },
  },
});
