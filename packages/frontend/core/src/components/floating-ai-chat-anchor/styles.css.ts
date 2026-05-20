import { cssVar } from '@toeverything/theme';
import { keyframes, style } from '@vanilla-extract/css';

// Manut M2 E2.8 — idle pulse keyframes for the floating Star AI button.
// Subtle scale + halo expansion every ~4s; expands the box-shadow's
// outer ring so the violet glow "breathes" instead of the whole button
// jumping (which would be distracting). Suppressed via media query
// further down for users with prefers-reduced-motion: reduce.
const idlePulse = keyframes({
  '0%': {
    boxShadow:
      '0 6px 16px rgba(0, 0, 0, 0.12), 0 2px 6px rgba(124, 58, 237, 0.24), 0 0 0 0 rgba(124, 58, 237, 0.4)',
  },
  '70%': {
    boxShadow:
      '0 6px 16px rgba(0, 0, 0, 0.12), 0 2px 6px rgba(124, 58, 237, 0.24), 0 0 0 10px rgba(124, 58, 237, 0)',
  },
  '100%': {
    boxShadow:
      '0 6px 16px rgba(0, 0, 0, 0.12), 0 2px 6px rgba(124, 58, 237, 0.24), 0 0 0 0 rgba(124, 58, 237, 0)',
  },
});

// Floating button — bottom-right anchor. Sits next to (and above) the existing
// AI Island when both are present. The AI Island lives at bottom: 16. We park
// our anchor a bit higher so it doesn't collide on /chat routes where the
// island is suppressed (the offset is harmless when both render together).
//
// We deliberately reference raw CSS variables here rather than importing
// design tokens. The Manut tokens (--manut-*) are defined globally in
// `packages/frontend/component/src/theme/manut-tokens.css` and consumed via
// var() to keep this .css.ts file leaf-safe in vanilla-extract's Node VM
// (HTMLElement-touching siblings have bitten us before — see CLAUDE.md §6).
export const anchorContainer = style({
  position: 'fixed',
  right: 16,
  bottom: 80,
  zIndex: 100,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-end',
  gap: 12,
  pointerEvents: 'none',
});

export const anchorButton = style({
  width: 44,
  height: 44,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '50%',
  background: 'var(--manut-accent-violet-fg)',
  color: '#ffffff',
  border: 'none',
  boxShadow:
    '0 6px 16px rgba(0, 0, 0, 0.12), 0 2px 6px rgba(124, 58, 237, 0.24)',
  cursor: 'pointer',
  pointerEvents: 'auto',
  fontSize: 18,
  fontWeight: 600,
  transition:
    'transform var(--affine-anim-duration-fast) var(--affine-anim-curve-default), box-shadow var(--affine-anim-duration-fast) var(--affine-anim-curve-default)',
  selectors: {
    // Idle pulse: only when the panel is closed (data-idle="true").
    // 4s interval, infinite. Brand-violet halo expands then fades.
    // The `prefers-reduced-motion: reduce` media query lives INSIDE
    // this selector (via vanilla-extract's `@media`) so its specificity
    // matches the attribute selector and the override wins reliably,
    // rather than fighting cascade against a top-level @media block.
    '&[data-idle="true"]': {
      animation: `${idlePulse} 4s ease-in-out infinite`,
      '@media': {
        '(prefers-reduced-motion: reduce)': {
          animation: 'none',
        },
      },
    },
    '&:hover': {
      transform: 'translateY(-1px)',
      boxShadow:
        '0 10px 24px rgba(0, 0, 0, 0.16), 0 4px 10px rgba(124, 58, 237, 0.32)',
      animation: 'none',
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

// Slide-in panel container. Lives at the right edge.
// Motion polish: framer-motion AnimatePresence now drives the slide
// animation via SPRING_GENTLE (see index.tsx). We keep the .panel
// class for layout + shadow + radius; the `transform` / `opacity` /
// `transition` properties are owned by motion at runtime. The
// data-open attribute is preserved for any existing query selectors
// that lock onto it (e.g. e2e tests).
export const panel = style({
  position: 'fixed',
  top: 16,
  bottom: 16,
  right: 16,
  width: 'min(420px, calc(100vw - 32px))',
  background: cssVar('backgroundOverlayPanelColor'),
  borderRadius: 'var(--manut-radius-card)',
  border: `0.5px solid ${cssVar('borderColor')}`,
  boxShadow: '0 12px 40px rgba(0, 0, 0, 0.18)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  zIndex: 101,
  pointerEvents: 'auto',
});

export const panelHeader = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 16px',
  borderBottom: `0.5px solid ${cssVar('borderColor')}`,
  minHeight: 48,
  flexShrink: 0,
});

export const panelTitle = style({
  fontSize: 14,
  fontWeight: 600,
  color: cssVar('textPrimaryColor'),
});

export const closeButton = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 28,
  height: 28,
  border: 'none',
  background: 'transparent',
  borderRadius: 'var(--manut-radius-input)',
  color: cssVar('iconColor'),
  cursor: 'pointer',
  selectors: {
    '&:hover': {
      background: cssVar('hoverColor'),
    },
  },
});

// Context chip — page icon + title + remove-context button.
export const contextChipRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 16px',
  borderBottom: `0.5px solid ${cssVar('borderColor')}`,
  flexShrink: 0,
});

export const contextChip = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '4px 8px',
  borderRadius: 'var(--manut-radius-input)',
  background: 'var(--manut-accent-violet-bg)',
  border: '0.5px solid var(--manut-accent-violet-border)',
  color: 'var(--manut-accent-violet-fg)',
  fontSize: 12,
  fontWeight: 500,
  maxWidth: '100%',
});

export const contextChipTitle = style({
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  maxWidth: 240,
});

export const contextChipRemove = style({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 16,
  height: 16,
  border: 'none',
  background: 'transparent',
  color: 'inherit',
  cursor: 'pointer',
  borderRadius: '50%',
  selectors: {
    '&:hover': {
      background: 'rgba(124, 58, 237, 0.16)',
    },
  },
});

// Body slot for the chat content. The Lit AIChatContent element is appended
// to this container imperatively (the React effect handles append/cleanup).
export const panelBody = style({
  flex: 1,
  minHeight: 0,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
});

// Placeholder shown while the chat is loading or when the workspace has not
// fully booted. Keeps the panel from being a blank rectangle on first open.
export const panelPlaceholder = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  flex: 1,
  padding: 24,
  color: cssVar('textSecondaryColor'),
  fontSize: 13,
  textAlign: 'center',
});
