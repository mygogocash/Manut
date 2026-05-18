import { style } from '@vanilla-extract/css';

// All vanilla-extract `style({...})` calls MUST live in `.css.ts` files
// per CLAUDE.md §6 — calling style({}) from .tsx compiles fine but
// throws at runtime and kills the React mount silently. This is the
// scar from v1.7.x.
//
// Animation rules: keep transitions on compositor-friendly properties
// (background-color, opacity). No animating width/height/padding.

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
  fontSize: 12,
  color: 'var(--affine-text-secondary-color)',
});

export const revisionList = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
});

export const revisionRow = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  padding: '10px 12px',
  borderRadius: 6,
  border: '1px solid var(--affine-border-color)',
  backgroundColor: 'var(--affine-background-secondary-color)',
  transition:
    'background-color var(--affine-anim-duration-base) var(--affine-anim-curve-default)',
});

export const revisionHeader = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
});

export const revisionLabel = style({
  fontWeight: 600,
  fontSize: 13,
  color: 'var(--affine-text-primary-color)',
});

export const revisionMeta = style({
  fontSize: 12,
  color: 'var(--affine-text-secondary-color)',
});

export const statusBadge = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '2px 8px',
  borderRadius: 10,
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: 0.3,
  textTransform: 'uppercase',
  selectors: {
    '&[data-status="DRAFT"]': {
      backgroundColor: 'var(--affine-hover-color)',
      color: 'var(--affine-text-secondary-color)',
    },
    '&[data-status="UNDER_REVIEW"]': {
      backgroundColor: 'var(--affine-warning-background-color, #fff4e0)',
      color: 'var(--affine-warning-color, #b47700)',
    },
    '&[data-status="APPROVED"]': {
      backgroundColor: 'var(--affine-success-background-color, #e6f9ee)',
      color: 'var(--affine-success-color, #058048)',
    },
    '&[data-status="REJECTED"]': {
      backgroundColor: 'var(--affine-error-background-color, #fdebec)',
      color: 'var(--affine-error-color, #c22f2e)',
    },
    '&[data-status="SUPERSEDED"]': {
      backgroundColor: 'var(--affine-hover-color)',
      color: 'var(--affine-text-disable-color, #888)',
    },
  },
});

export const bodyPreview = style({
  fontFamily:
    'var(--affine-font-mono, "JetBrains Mono", "Roboto Mono", monospace)',
  fontSize: 12,
  lineHeight: 1.5,
  padding: '8px 10px',
  borderRadius: 4,
  backgroundColor: 'var(--affine-background-primary-color)',
  border: '1px solid var(--affine-border-color)',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  maxHeight: 240,
  overflowY: 'auto',
});

export const commentList = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  marginTop: 4,
  paddingLeft: 8,
  borderLeft: '2px solid var(--affine-border-color)',
});

export const commentEntry = style({
  fontSize: 12,
  color: 'var(--affine-text-secondary-color)',
  selectors: {
    '&[data-decision="APPROVE"]': {
      color: 'var(--affine-success-color, #058048)',
    },
    '&[data-decision="REJECT"]': {
      color: 'var(--affine-error-color, #c22f2e)',
    },
  },
});

export const actions = style({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 6,
  marginTop: 4,
});

export const editorRoot = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: 12,
  borderRadius: 6,
  border: '1px solid var(--affine-border-color)',
  backgroundColor: 'var(--affine-background-primary-color)',
});

export const editorLabel = style({
  fontWeight: 600,
  fontSize: 13,
  color: 'var(--affine-text-primary-color)',
});

export const textarea = style({
  width: '100%',
  minHeight: 180,
  padding: '8px 10px',
  borderRadius: 4,
  border: '1px solid var(--affine-border-color)',
  fontSize: 12,
  fontFamily:
    'var(--affine-font-mono, "JetBrains Mono", "Roboto Mono", monospace)',
  backgroundColor: 'var(--affine-background-primary-color)',
  color: 'var(--affine-text-primary-color)',
  resize: 'vertical',
  selectors: {
    '&:focus': {
      outline: 'none',
      borderColor: 'var(--affine-primary-color)',
    },
  },
});

export const commentInput = style({
  width: '100%',
  padding: '6px 8px',
  borderRadius: 4,
  border: '1px solid var(--affine-border-color)',
  fontSize: 12,
  backgroundColor: 'var(--affine-background-primary-color)',
  color: 'var(--affine-text-primary-color)',
  selectors: {
    '&:focus': {
      outline: 'none',
      borderColor: 'var(--affine-primary-color)',
    },
  },
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
    '&:hover': { backgroundColor: 'var(--affine-hover-color)' },
    '&:disabled': { opacity: 0.5, cursor: 'not-allowed' },
  },
});

export const approveButton = style({
  padding: '6px 12px',
  borderRadius: 4,
  border: 'none',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 500,
  backgroundColor: 'var(--affine-success-color, #058048)',
  color: 'var(--affine-white)',
  transition:
    'opacity var(--affine-anim-duration-base) var(--affine-anim-curve-default)',
  selectors: {
    '&:hover': { opacity: 0.85 },
    '&:disabled': { opacity: 0.5, cursor: 'not-allowed' },
  },
});

export const rejectButton = style({
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
