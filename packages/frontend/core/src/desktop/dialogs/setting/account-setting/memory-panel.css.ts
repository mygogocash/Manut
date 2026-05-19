import { cssVarV2 } from '@toeverything/theme/v2';
import { style } from '@vanilla-extract/css';

// M2 — E2.2 — "What AI knows about me" memory panel styles.
//
// Manut design tokens (--manut-accent-violet-*, --manut-radius-card)
// are referenced as raw CSS vars rather than via an `@affine/component`
// JS export — see CLAUDE.md "vanilla-extract Node VM" scar: importing
// from a package root in a .css.ts file drags in DOM-touching siblings
// and crashes the build.

export const panel = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  padding: '12px 0 4px',
});

export const panelHeader = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
});

export const panelTitle = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 14,
  lineHeight: '22px',
  fontWeight: 500,
  color: cssVarV2.text.primary,
});

export const panelSubtitle = style({
  fontSize: 12,
  lineHeight: '18px',
  color: cssVarV2.text.secondary,
});

export const loading = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px 0',
  color: cssVarV2.text.secondary,
  fontSize: 13,
});

export const emptyState = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 6,
  padding: '32px 16px',
  borderRadius: 'var(--manut-radius-card, 8px)',
  border: `1px dashed ${cssVarV2.layer.insideBorder.border}`,
  background: cssVarV2.layer.background.secondary,
  color: cssVarV2.text.secondary,
  fontSize: 13,
  lineHeight: '20px',
  textAlign: 'center',
});

export const errorState = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  padding: '12px 16px',
  borderRadius: 'var(--manut-radius-card, 8px)',
  border: `1px solid ${cssVarV2.status.error}`,
  color: cssVarV2.status.error,
  fontSize: 12,
  lineHeight: '18px',
});

export const sectionGroup = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
});

export const sectionHeader = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 12,
  lineHeight: '18px',
  fontWeight: 500,
  color: cssVarV2.text.secondary,
  textTransform: 'uppercase',
  letterSpacing: 0.4,
});

export const sectionCount = style({
  fontSize: 11,
  fontWeight: 400,
  color: cssVarV2.text.tertiary,
});

export const memoryList = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
});

export const memoryRow = style({
  display: 'flex',
  gap: 12,
  padding: '12px 14px',
  borderRadius: 'var(--manut-radius-card, 8px)',
  border: `1px solid ${cssVarV2.layer.insideBorder.border}`,
  background: cssVarV2.layer.background.primary,
  transition: 'background-color 0.15s ease, border-color 0.15s ease',
  selectors: {
    '&[data-pinned="true"]': {
      borderLeft: '2px solid var(--manut-accent-violet-border, #7b61ff)',
      background: 'var(--manut-accent-violet-bg, rgba(123, 97, 255, 0.06))',
    },
    '&:hover': {
      background: cssVarV2.layer.background.hoverOverlay,
    },
  },
});

export const memoryMain = style({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  minWidth: 0,
});

export const memoryMeta = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexWrap: 'wrap',
});

export const kindBadge = style({
  display: 'inline-flex',
  alignItems: 'center',
  padding: '1px 8px',
  borderRadius: 999,
  fontSize: 10,
  fontWeight: 600,
  lineHeight: '16px',
  letterSpacing: 0.4,
  textTransform: 'uppercase',
  background: 'var(--manut-accent-violet-bg, rgba(123, 97, 255, 0.12))',
  color: 'var(--manut-accent-violet-fg, #7b61ff)',
  selectors: {
    '&[data-kind="DECISION"]': {
      background: cssVarV2.status.success,
      color: cssVarV2.text.onPrimary,
    },
    '&[data-kind="PLAYBOOK"]': {
      background: cssVarV2.layer.background.primary,
      color: cssVarV2.text.primary,
      border: `1px solid ${cssVarV2.layer.insideBorder.blackBorder}`,
    },
  },
});

export const scopeBadge = style({
  display: 'inline-flex',
  alignItems: 'center',
  padding: '1px 8px',
  borderRadius: 999,
  fontSize: 10,
  fontWeight: 500,
  lineHeight: '16px',
  color: cssVarV2.text.secondary,
  background: cssVarV2.layer.background.secondary,
});

export const pinnedDot = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  fontSize: 10,
  lineHeight: '16px',
  color: 'var(--manut-accent-violet-fg, #7b61ff)',
});

export const memoryContent = style({
  fontSize: 13,
  lineHeight: '20px',
  color: cssVarV2.text.primary,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  display: '-webkit-box',
  WebkitLineClamp: 3,
  WebkitBoxOrient: 'vertical',
  wordBreak: 'break-word',
});

export const memoryTimestamp = style({
  fontSize: 11,
  lineHeight: '16px',
  color: cssVarV2.text.tertiary,
});

export const memoryActions = style({
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  flexShrink: 0,
});
