import { cssVar } from '@toeverything/theme';
import { globalStyle, style } from '@vanilla-extract/css';

// Notion-style sticky time-bucket group heading. Per CLAUDE.md §6,
// `.css.ts` reads Manut tokens as raw CSS vars with fallbacks rather
// than importing from `@affine/component` package root (Node-VM trap).

export const groupHeading = style({
  position: 'sticky',
  top: 0,
  zIndex: 2,
  padding: '6px 12px',
  margin: '0 -6px',
  fontSize: cssVar('fontXs'),
  fontWeight: 600,
  letterSpacing: 0.4,
  textTransform: 'uppercase',
  color: cssVar('textSecondaryColor'),
  background: cssVar('backgroundOverlayPanelColor'),
  backdropFilter: 'blur(8px)',
});

export const groupHeadingEmpty = style({
  display: 'none',
});

export const groupItemSelectedAccent = style({});

// When a row inside the group is selected, paint with Manut violet.
globalStyle(`[cmdk-item][data-selected=true].${groupItemSelectedAccent}`, {
  background: 'var(--manut-accent-violet-bg, rgba(123, 97, 255, 0.10))',
  color: 'var(--manut-accent-violet-fg, var(--affine-text-primary-color))',
  boxShadow: 'inset 2px 0 0 var(--manut-accent-violet-border, #7b61ff)',
});
