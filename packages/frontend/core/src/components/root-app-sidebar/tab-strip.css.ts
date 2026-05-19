import { cssVar } from '@toeverything/theme';
import { style } from '@vanilla-extract/css';

// Tab strip — five icon buttons sitting at the top of the sidebar.
// Brand tokens (`--manut-*`) are defined globally in
// `packages/frontend/component/src/theme/manut-tokens.css`. We reference
// raw CSS variables here instead of importing token objects so this file
// stays leaf-safe in vanilla-extract's Node VM evaluation pass (the
// HTMLElement-touching siblings scar — see CLAUDE.md §6).

export const tabStripRoot = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 4,
  padding: '8px 6px',
  borderBottom: `0.5px solid ${cssVar('borderColor')}`,
  flexShrink: 0,
});

export const tabButton = style({
  flex: '1 1 0',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: 32,
  border: 'none',
  background: 'transparent',
  color: cssVar('iconColor'),
  borderRadius: 'var(--manut-radius-input)',
  cursor: 'pointer',
  fontSize: 18,
  transition:
    'background var(--affine-anim-duration-fast) var(--affine-anim-curve-default), color var(--affine-anim-duration-fast) var(--affine-anim-curve-default)',
  selectors: {
    '&:hover': {
      background: cssVar('hoverColor'),
      color: cssVar('iconSecondary'),
    },
    '&[data-active="true"]': {
      background: 'var(--manut-accent-violet-bg)',
      color: 'var(--manut-accent-violet-fg)',
    },
    '&:focus-visible': {
      outline: '2px solid var(--manut-accent-violet-fg)',
      outlineOffset: 2,
    },
  },
});

// Placeholder view shell — centered "coming soon" message.
export const placeholderRoot = style({
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

export const placeholderIcon = style({
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

export const placeholderTitle = style({
  fontSize: 14,
  fontWeight: 600,
  color: cssVar('textPrimaryColor'),
});

export const placeholderCopy = style({
  fontSize: 12,
  fontWeight: 400,
  color: cssVar('textSecondaryColor'),
  maxWidth: 220,
  lineHeight: 1.5,
});

// Customize-sections popover.
export const sectionEditorRoot = style({
  display: 'flex',
  flexDirection: 'column',
  minWidth: 240,
  padding: 8,
  gap: 4,
});

export const sectionEditorHeader = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '4px 8px 8px',
  borderBottom: `0.5px solid ${cssVar('borderColor')}`,
  marginBottom: 4,
});

export const sectionEditorTitle = style({
  fontSize: 12,
  fontWeight: 600,
  color: cssVar('textPrimaryColor'),
  textTransform: 'uppercase',
  letterSpacing: 0.4,
});

export const sectionEditorRow = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '6px 8px',
  borderRadius: 'var(--manut-radius-input)',
  cursor: 'pointer',
  transition:
    'background var(--affine-anim-duration-fast) var(--affine-anim-curve-default)',
  selectors: {
    '&:hover': {
      background: cssVar('hoverColor'),
    },
  },
});

export const sectionEditorLabel = style({
  fontSize: 13,
  fontWeight: 500,
  color: cssVar('textPrimaryColor'),
});

export const sectionEditorEye = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 20,
  height: 20,
  color: cssVar('iconColor'),
  selectors: {
    '&[data-hidden="true"]': {
      color: cssVar('textDisableColor'),
    },
  },
});

// Customize-sections trigger that sits inside the Home view.
export const customizeTriggerRow = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 12px',
  fontSize: 11,
  fontWeight: 500,
  color: cssVar('textSecondaryColor'),
  textTransform: 'uppercase',
  letterSpacing: 0.4,
});

export const customizeTriggerButton = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '2px 6px',
  border: 'none',
  background: 'transparent',
  color: 'var(--manut-accent-violet-fg)',
  borderRadius: 'var(--manut-radius-input)',
  fontSize: 11,
  fontWeight: 500,
  cursor: 'pointer',
  selectors: {
    '&:hover': {
      background: 'var(--manut-accent-violet-bg)',
    },
  },
});
