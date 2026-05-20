import { cssVar } from '@toeverything/theme';
import { style } from '@vanilla-extract/css';

// Notion-style Chat tab body. Per CLAUDE.md §6 vanilla-extract Node-VM
// trap, this file only imports from `@toeverything/theme` and
// `@vanilla-extract/css` — raw CSS variables (`--manut-*`,
// `--affine-anim-*`) are referenced as strings instead of via package-
// root token imports.

export const viewRoot = style({
  display: 'flex',
  flexDirection: 'column',
  padding: '0 6px',
  // Sidebar bodies own their own vertical rhythm — the scrollable
  // container above provides the height, we just pad inside it.
});

// "Notion AI" section ------------------------------------------------------
// Two-column card row at the top: agent avatar plate + "+ New agent" plate.
// Matches the Notion screenshot where the avatar is a primary brand chip
// and the "+ New agent" sits as a dotted/secondary chip beside it.
export const agentSection = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: '12px 6px 16px 6px',
});

export const agentHeader = style({
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '0 6px 4px',
  fontSize: 11,
  fontWeight: 600,
  color: cssVar('textSecondaryColor'),
  textTransform: 'uppercase',
  letterSpacing: 0.4,
  userSelect: 'none',
});

export const agentRow = style({
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 8,
});

export const agentCardBase = style({
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  minHeight: 76,
  padding: '10px 12px',
  borderRadius: 'var(--manut-radius-card)',
  border: `0.5px solid ${cssVar('borderColor')}`,
  background: cssVar('backgroundSecondaryColor'),
  color: cssVar('textPrimaryColor'),
  cursor: 'pointer',
  textAlign: 'left',
  fontFamily: 'inherit',
  fontSize: 12,
  fontWeight: 500,
  transition:
    'background var(--affine-anim-duration-fast) var(--affine-anim-curve-default), border-color var(--affine-anim-duration-fast) var(--affine-anim-curve-default)',
  selectors: {
    '&:hover': {
      background: cssVar('hoverColor'),
      borderColor: 'var(--manut-accent-violet-fg)',
    },
    '&:focus-visible': {
      outline: '2px solid var(--manut-accent-violet-fg)',
      outlineOffset: 2,
    },
  },
});

export const agentCardPrimary = style({
  background: 'var(--manut-accent-violet-bg)',
  borderColor: 'transparent',
  color: 'var(--manut-accent-violet-fg)',
  selectors: {
    '&:hover': {
      background: 'var(--manut-accent-violet-bg)',
      borderColor: 'var(--manut-accent-violet-fg)',
    },
  },
});

export const agentCardPlus = style({
  // Dotted border + transparent background mirrors the Notion screenshot
  // where "+ New agent" reads as an empty slot waiting to be filled.
  background: 'transparent',
  borderStyle: 'dashed',
  borderRadius: 'var(--manut-radius-card)',
});

export const agentAvatarPlate = style({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 28,
  height: 28,
  borderRadius: 'var(--manut-radius-input)',
  background: 'var(--manut-accent-violet-fg)',
  color: cssVar('backgroundPrimaryColor'),
  fontSize: 14,
  fontWeight: 600,
});

export const agentCardLabel = style({
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: 0.1,
});

export const agentCardCaption = style({
  fontSize: 10,
  fontWeight: 400,
  color: cssVar('textSecondaryColor'),
});

// History list -------------------------------------------------------------
export const historySection = style({
  display: 'flex',
  flexDirection: 'column',
});

export const historyHeader = style({
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 12px 4px',
  fontSize: 11,
  fontWeight: 600,
  color: cssVar('textSecondaryColor'),
  textTransform: 'uppercase',
  letterSpacing: 0.4,
  userSelect: 'none',
});

export const historyList = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 1,
});

export const historyRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 10px',
  borderRadius: 'var(--manut-radius-input)',
  border: 'none',
  background: 'transparent',
  color: cssVar('textPrimaryColor'),
  cursor: 'pointer',
  textAlign: 'left',
  fontFamily: 'inherit',
  fontSize: 13,
  fontWeight: 400,
  width: '100%',
  transition:
    'background var(--affine-anim-duration-fast) var(--affine-anim-curve-default), color var(--affine-anim-duration-fast) var(--affine-anim-curve-default)',
  selectors: {
    '&:hover': {
      background: cssVar('hoverColor'),
    },
    '&[data-active="true"]': {
      background: 'var(--manut-accent-violet-bg)',
      color: 'var(--manut-accent-violet-fg)',
    },
    '&:focus-visible': {
      outline: '2px solid var(--manut-accent-violet-fg)',
      outlineOffset: -2,
    },
  },
});

export const historyIcon = style({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  width: 16,
  height: 16,
  color: cssVar('iconColor'),
  fontSize: 14,
});

export const historyTitle = style({
  flex: 1,
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const historyTimestamp = style({
  flexShrink: 0,
  fontSize: 11,
  fontWeight: 400,
  color: cssVar('textSecondaryColor'),
  textTransform: 'lowercase',
  fontVariantNumeric: 'tabular-nums',
});

export const groupHeading = style({
  padding: '12px 12px 4px',
  fontSize: 11,
  fontWeight: 600,
  color: cssVar('textSecondaryColor'),
  textTransform: 'uppercase',
  letterSpacing: 0.4,
  userSelect: 'none',
});

// Empty / error states -----------------------------------------------------
export const emptyState = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
  padding: '24px 24px 32px',
  textAlign: 'center',
  color: cssVar('textSecondaryColor'),
});

export const emptyIcon = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 36,
  height: 36,
  borderRadius: 'var(--manut-radius-card)',
  background: 'var(--manut-accent-violet-bg)',
  color: 'var(--manut-accent-violet-fg)',
  fontSize: 18,
});

export const emptyTitle = style({
  fontSize: 13,
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

export const loadingState = style({
  padding: '12px 12px 24px',
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
});

export const loadingRow = style({
  height: 14,
  borderRadius: 4,
  background: cssVar('backgroundSecondaryColor'),
  opacity: 0.6,
});
