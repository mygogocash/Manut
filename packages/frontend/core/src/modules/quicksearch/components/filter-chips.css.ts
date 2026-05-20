import { cssVar } from '@toeverything/theme';
import { globalStyle, style } from '@vanilla-extract/css';

// Manut design tokens (--manut-accent-violet-*, --manut-radius-input)
// Tokens are read as raw CSS vars (with fallbacks) per CLAUDE.md §6:
// avoid `@affine/component` package-root imports in `.css.ts` files because
// vanilla-extract evaluates them in a Node VM and they reference `HTMLElement`.

export const chipsRow = style({
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 6,
  padding: '0 16px 12px',
  width: '100%',
  flexShrink: 0,
});

export const chip = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  height: 26,
  padding: '0 10px',
  borderRadius: 'var(--manut-radius-input, 6px)',
  fontSize: cssVar('fontXs'),
  lineHeight: 1,
  fontWeight: 500,
  color: cssVar('textSecondaryColor'),
  background: cssVar('backgroundSecondaryColor'),
  border: `1px solid transparent`,
  cursor: 'pointer',
  userSelect: 'none',
  whiteSpace: 'nowrap',
  transition:
    'background-color var(--affine-anim-duration-fast, 120ms) ease, color var(--affine-anim-duration-fast, 120ms) ease, border-color var(--affine-anim-duration-fast, 120ms) ease',
});

globalStyle(`${chip}:hover`, {
  background: cssVar('hoverColor'),
  color: cssVar('textPrimaryColor'),
});

export const chipActive = style({
  background: 'var(--manut-accent-violet-bg, rgba(123, 97, 255, 0.12))',
  color: 'var(--manut-accent-violet-fg, #7b61ff)',
  borderColor: 'var(--manut-accent-violet-border, rgba(123, 97, 255, 0.35))',
});

export const chipAddFilter = style({
  fontWeight: 500,
});

export const chipMenu = style({
  position: 'absolute',
  top: 'calc(100% + 4px)',
  left: 0,
  minWidth: 200,
  maxWidth: 320,
  padding: 4,
  background: cssVar('backgroundOverlayPanelColor'),
  borderRadius: 'var(--manut-radius-card, 8px)',
  boxShadow: cssVar('shadow2'),
  zIndex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
});

export const chipWrapper = style({
  position: 'relative',
  display: 'inline-flex',
});

export const chipMenuItem = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 10px',
  borderRadius: 4,
  fontSize: cssVar('fontXs'),
  color: cssVar('textPrimaryColor'),
  cursor: 'pointer',
  userSelect: 'none',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
});

globalStyle(`${chipMenuItem}:hover`, {
  background: cssVar('hoverColor'),
});

export const chipMenuItemActive = style({
  background: 'var(--manut-accent-violet-bg, rgba(123, 97, 255, 0.08))',
  color: 'var(--manut-accent-violet-fg, #7b61ff)',
});

export const chipCaret = style({
  fontSize: 10,
  opacity: 0.6,
});

export const chipMenuDivider = style({
  height: 1,
  margin: '2px 4px',
  background: cssVar('dividerColor'),
});
