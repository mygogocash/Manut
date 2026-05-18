import { style } from '@vanilla-extract/css';

// All vanilla-extract `style({...})` calls MUST live in `.css.ts` files
// per CLAUDE.md §6 — calling style({}) from .tsx compiles fine but
// throws at runtime and kills the React mount silently. This is the
// scar from v1.7.x.

export const panelRoot = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  padding: '12px 0',
  fontSize: 13,
  lineHeight: 1.4,
  color: 'var(--affine-text-primary-color)',
});

export const header = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
});

export const title = style({
  fontWeight: 600,
  fontSize: 14,
  color: 'var(--affine-text-primary-color)',
});

export const summary = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '2px 10px',
  borderRadius: 12,
  fontSize: 12,
  fontWeight: 500,
  selectors: {
    '&[data-state="empty"]': {
      backgroundColor: 'var(--affine-hover-color)',
      color: 'var(--affine-text-secondary-color)',
    },
    '&[data-state="ok"]': {
      backgroundColor: 'var(--affine-success-background-color, #e6f9ee)',
      color: 'var(--affine-success-color, #058048)',
    },
    '&[data-state="fail"]': {
      backgroundColor: 'var(--affine-error-background-color, #fdebec)',
      color: 'var(--affine-error-color, #c22f2e)',
    },
    '&[data-state="loading"]': {
      backgroundColor: 'var(--affine-hover-color)',
      color: 'var(--affine-text-secondary-color)',
    },
  },
});

export const predicateList = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
});

export const predicateRow = style({
  display: 'flex',
  alignItems: 'flex-start',
  gap: 10,
  padding: '8px 10px',
  borderRadius: 6,
  backgroundColor: 'var(--affine-background-secondary-color)',
  transition:
    'background-color var(--affine-anim-duration-base) var(--affine-anim-curve-default)',
  selectors: {
    '&[data-satisfied="true"]': {
      backgroundColor: 'var(--affine-success-background-color, #e6f9ee)',
    },
    '&[data-satisfied="false"]': {
      backgroundColor: 'var(--affine-error-background-color, #fdebec)',
    },
  },
});

export const predicateStatus = style({
  width: 16,
  height: 16,
  borderRadius: 8,
  flexShrink: 0,
  marginTop: 2,
  selectors: {
    '&[data-satisfied="true"]': {
      backgroundColor: 'var(--affine-success-color, #058048)',
    },
    '&[data-satisfied="false"]': {
      backgroundColor: 'var(--affine-error-color, #c22f2e)',
    },
  },
});

export const predicateBody = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  flex: '1 1 auto',
  minWidth: 0,
});

export const predicateKind = style({
  fontWeight: 600,
  fontSize: 12,
  letterSpacing: 0.4,
  textTransform: 'uppercase',
  color: 'var(--affine-text-secondary-color)',
});

export const predicateSummaryLine = style({
  fontSize: 13,
  color: 'var(--affine-text-primary-color)',
  wordBreak: 'break-word',
});

export const predicateReason = style({
  fontSize: 12,
  color: 'var(--affine-text-secondary-color)',
  fontStyle: 'italic',
});

export const editorRoot = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  padding: 12,
  borderRadius: 6,
  border: '1px solid var(--affine-border-color)',
  backgroundColor: 'var(--affine-background-primary-color)',
});

export const editorRow = style({
  display: 'grid',
  gridTemplateColumns: '120px 1fr auto',
  gap: 8,
  alignItems: 'center',
});

export const input = style({
  width: '100%',
  padding: '6px 8px',
  borderRadius: 4,
  border: '1px solid var(--affine-border-color)',
  fontSize: 13,
  backgroundColor: 'var(--affine-background-primary-color)',
  color: 'var(--affine-text-primary-color)',
  selectors: {
    '&:focus': {
      outline: 'none',
      borderColor: 'var(--affine-primary-color)',
    },
  },
});

export const select = style({
  padding: '6px 8px',
  borderRadius: 4,
  border: '1px solid var(--affine-border-color)',
  fontSize: 13,
  backgroundColor: 'var(--affine-background-primary-color)',
  color: 'var(--affine-text-primary-color)',
});

export const buttonRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
});

export const primaryButton = style({
  padding: '6px 12px',
  borderRadius: 4,
  border: 'none',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 500,
  backgroundColor: 'var(--affine-primary-color)',
  color: 'var(--affine-white)',
  transition:
    'opacity var(--affine-anim-duration-base) var(--affine-anim-curve-default)',
  selectors: {
    '&:hover': { opacity: 0.85 },
    '&:disabled': { opacity: 0.5, cursor: 'not-allowed' },
  },
});

export const secondaryButton = style({
  padding: '6px 12px',
  borderRadius: 4,
  border: '1px solid var(--affine-border-color)',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 500,
  backgroundColor: 'transparent',
  color: 'var(--affine-text-primary-color)',
  transition:
    'background-color var(--affine-anim-duration-base) var(--affine-anim-curve-default)',
  selectors: {
    '&:hover': {
      backgroundColor: 'var(--affine-hover-color)',
    },
    '&:disabled': { opacity: 0.5, cursor: 'not-allowed' },
  },
});

export const dangerButton = style({
  padding: '6px 12px',
  borderRadius: 4,
  border: 'none',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 500,
  backgroundColor: 'var(--affine-error-color, #c22f2e)',
  color: 'var(--affine-white)',
  transition:
    'opacity var(--affine-anim-duration-base) var(--affine-anim-curve-default)',
  selectors: {
    '&:hover': { opacity: 0.85 },
    '&:disabled': { opacity: 0.5, cursor: 'not-allowed' },
  },
});

export const emptyState = style({
  padding: '12px 0',
  fontSize: 13,
  fontStyle: 'italic',
  color: 'var(--affine-text-secondary-color)',
});

export const errorMessage = style({
  fontSize: 12,
  color: 'var(--affine-error-color, #c22f2e)',
});
