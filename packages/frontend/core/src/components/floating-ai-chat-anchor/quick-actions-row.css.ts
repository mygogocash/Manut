import { cssVar } from '@toeverything/theme';
import { style } from '@vanilla-extract/css';

// Epic E1.10 — empty-state quick-action chips for the floating chat
// panel. Sits inside the panelBody between the header (or context
// chip row) and the chat composer when there are no messages yet.
//
// Following the CLAUDE.md vanilla-extract scar (§6) we DON'T import
// design tokens from `@affine/component` at this leaf level. Use
// `cssVar('...')` for upstream tokens and raw `var(--manut-...)` for
// the Manut palette tokens — both keep this file Node-VM safe.

export const row = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  padding: '8px 16px 4px',
  flexShrink: 0,
});

export const label = style({
  fontSize: 11,
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: cssVar('textSecondaryColor'),
});

export const chips = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: 6,
});

export const chip = style({
  display: 'inline-flex',
  alignItems: 'center',
  padding: '4px 10px',
  borderRadius: 'var(--manut-radius-input)',
  background: 'var(--manut-accent-violet-bg)',
  color: 'var(--manut-accent-violet-fg)',
  border: '0.5px solid var(--manut-accent-violet-border)',
  fontSize: 12,
  fontWeight: 500,
  lineHeight: '18px',
  cursor: 'pointer',
  // Compositor-friendly transition (transform + background-color only)
  // per the frontend performance rules in the global ECC ruleset.
  transition:
    'background-color var(--affine-anim-duration-fast) var(--affine-anim-curve-default), transform var(--affine-anim-duration-fast) var(--affine-anim-curve-default)',
  selectors: {
    '&:hover': {
      background: 'rgba(124, 58, 237, 0.16)',
      transform: 'translateY(-1px)',
    },
    '&:active': {
      transform: 'translateY(0)',
    },
    '&:focus-visible': {
      outline: '2px solid var(--manut-accent-violet-fg)',
      outlineOffset: 2,
    },
  },
});
