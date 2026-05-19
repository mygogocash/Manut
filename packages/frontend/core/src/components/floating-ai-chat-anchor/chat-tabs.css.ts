import { cssVar } from '@toeverything/theme';
import { style } from '@vanilla-extract/css';

// Manut Wave 6 E2.5 — floating multi-chat tab strip styles.
//
// Same leaf-safety constraint as ./styles.css.ts: do NOT import design
// tokens from `@affine/component` package root. Reference `--manut-*`
// raw CSS variables (defined in
// packages/frontend/component/src/theme/manut-tokens.css) directly so
// vanilla-extract's Node VM doesn't drag in DOM-touching sibling
// exports (CLAUDE.md §6 — "vanilla-extract evaluates .css.ts files in
// a Node VM at build time").

export const tabStrip = style({
  display: 'flex',
  alignItems: 'stretch',
  gap: 4,
  padding: '6px 8px',
  borderBottom: `0.5px solid ${cssVar('borderColor')}`,
  flexShrink: 0,
  minHeight: 36,
  overflowX: 'auto',
  overflowY: 'hidden',
  // Hide native scrollbar on macOS; Firefox + chrome get a thin track
  // underneath the tabs when overflow kicks in but it's mostly hidden
  // by the panel's bottom border anyway.
  scrollbarWidth: 'none',
  selectors: {
    '&::-webkit-scrollbar': {
      display: 'none',
    },
  },
});

export const tab = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '4px 8px 4px 10px',
  borderRadius: 'var(--manut-radius-input)',
  background: 'transparent',
  border: `0.5px solid ${cssVar('borderColor')}`,
  color: cssVar('textSecondaryColor'),
  fontSize: 12,
  fontWeight: 500,
  cursor: 'pointer',
  flexShrink: 0,
  maxWidth: 160,
  minWidth: 0,
  transition:
    'background-color var(--affine-anim-duration-fast) var(--affine-anim-curve-default), color var(--affine-anim-duration-fast) var(--affine-anim-curve-default)',
  selectors: {
    '&:hover': {
      background: cssVar('hoverColor'),
      color: cssVar('textPrimaryColor'),
    },
    // Active tab gets the brand-accent ring so users can spot the
    // currently focused chat at a glance.
    '&[data-active="true"]': {
      background: 'var(--manut-accent-violet-bg)',
      borderColor: 'var(--manut-accent-violet-border)',
      color: 'var(--manut-accent-violet-fg)',
    },
    '&[data-active="true"]:hover': {
      background: 'var(--manut-accent-violet-bg)',
    },
    '&:focus-visible': {
      outline: '2px solid var(--manut-accent-violet-fg)',
      outlineOffset: 1,
    },
  },
});

export const tabTitle = style({
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  minWidth: 0,
  flex: 1,
});

export const tabPinIcon = style({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 14,
  height: 14,
  flexShrink: 0,
  color: 'currentColor',
  opacity: 0.55,
  selectors: {
    '&[data-pinned="true"]': {
      // Pinned tabs show the filled pin glyph with full opacity so the
      // sticky-context state is obvious without hovering.
      opacity: 1,
      color: 'var(--manut-accent-violet-fg)',
    },
  },
});

export const tabCloseButton = style({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 14,
  height: 14,
  border: 'none',
  background: 'transparent',
  color: 'inherit',
  cursor: 'pointer',
  borderRadius: '50%',
  flexShrink: 0,
  opacity: 0.6,
  padding: 0,
  selectors: {
    '&:hover': {
      opacity: 1,
      background: 'rgba(124, 58, 237, 0.16)',
    },
    '&:focus-visible': {
      outline: '1px solid var(--manut-accent-violet-fg)',
      outlineOffset: 1,
      opacity: 1,
    },
  },
});

export const addTabButton = style({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 28,
  height: 28,
  borderRadius: 'var(--manut-radius-input)',
  background: 'transparent',
  border: `0.5px solid ${cssVar('borderColor')}`,
  color: cssVar('iconColor'),
  cursor: 'pointer',
  flexShrink: 0,
  marginLeft: 'auto',
  alignSelf: 'center',
  selectors: {
    '&:hover': {
      background: cssVar('hoverColor'),
      color: cssVar('textPrimaryColor'),
    },
    '&:focus-visible': {
      outline: '2px solid var(--manut-accent-violet-fg)',
      outlineOffset: 1,
    },
    '&:disabled': {
      opacity: 0.4,
      cursor: 'not-allowed',
    },
  },
});
