import { cssVar } from '@toeverything/theme';
import { style } from '@vanilla-extract/css';

/**
 * Shortcuts overlay (Cmd+/). vanilla-extract evaluates in a Node VM
 * at build time — Manut tokens are referenced as raw CSS vars to
 * avoid pulling `@affine/component` package-root into the VM (see
 * CLAUDE.md §6 scar). We rely on tokens declared in
 * `packages/frontend/component/src/theme/manut-tokens.css`.
 */

export const overlayRoot = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 20,
  padding: '24px',
  maxHeight: '70vh',
  overflow: 'auto',
  borderRadius: 'var(--manut-radius-card, 14px)',
});

export const overlayHeader = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
});

export const overlayTitle = style({
  fontSize: cssVar('fontH6'),
  fontWeight: 600,
  color: cssVar('textPrimaryColor'),
  margin: 0,
});

export const overlaySubtitle = style({
  fontSize: cssVar('fontSm'),
  color: cssVar('textSecondaryColor'),
  margin: 0,
});

export const groupGrid = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 1fr)',
  gap: 16,
  '@media': {
    '(max-width: 600px)': {
      gridTemplateColumns: '1fr',
    },
  },
});

export const groupCard = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: '12px 14px',
  borderRadius: 'var(--manut-radius-card, 14px)',
  background: cssVar('backgroundSecondaryColor'),
  border: `1px solid ${cssVar('dividerColor')}`,
});

export const groupHeading = style({
  fontSize: cssVar('fontXs'),
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: 'var(--manut-accent-violet-fg, #7c3aed)',
  margin: 0,
});

export const shortcutRow = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  padding: '6px 0',
});

export const shortcutLabel = style({
  fontSize: cssVar('fontSm'),
  color: cssVar('textPrimaryColor'),
  flex: 1,
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const shortcutKeys = style({
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  flexShrink: 0,
});

export const shortcutKey = style({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 22,
  height: 22,
  padding: '0 6px',
  borderRadius: 'var(--manut-radius-chip, 4px)',
  background: cssVar('backgroundTertiaryColor'),
  color: cssVar('textPrimaryColor'),
  fontSize: 11,
  fontFamily: 'inherit',
  border: `1px solid ${cssVar('dividerColor')}`,
});

export const shortcutKeyActive = style({
  background: 'var(--manut-accent-violet-bg, rgba(124, 58, 237, 0.08))',
  borderColor: 'var(--manut-accent-violet-border, rgba(124, 58, 237, 0.32))',
  color: 'var(--manut-accent-violet-fg, #7c3aed)',
});

export const overlayHint = style({
  marginTop: 6,
  fontSize: cssVar('fontXs'),
  color: cssVar('textSecondaryColor'),
  textAlign: 'center',
});
