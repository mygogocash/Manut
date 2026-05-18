import { style } from '@vanilla-extract/css';

/**
 * Work Queues panel styles (M14). vanilla-extract `style({})` MUST live
 * in `.css.ts` files — see CLAUDE.md §6 scar about the
 * `style({})`-from-tsx runtime crash. CSS variables are referenced raw
 * to keep this file a leaf module under vanilla-extract's Node-VM
 * evaluator.
 */

export const wrapper = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
});

export const sectionHeader = style({
  fontSize: 14,
  fontWeight: 600,
  color: 'var(--affine-text-primary-color)',
  marginBottom: 4,
});

export const queueCard = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  padding: 16,
  border: '1px solid var(--affine-border-color)',
  borderRadius: 8,
  background: 'var(--affine-background-primary-color)',
});

export const queueHeader = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
});

export const queueTitle = style({
  fontSize: 14,
  fontWeight: 600,
  color: 'var(--affine-text-primary-color)',
});

export const queueDescription = style({
  fontSize: 12,
  color: 'var(--affine-text-secondary-color)',
});

export const tokenRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 12px',
  background: 'var(--affine-hover-color)',
  borderRadius: 6,
  fontFamily: 'var(--affine-font-code-family, monospace)',
  fontSize: 12,
});

export const tokenValue = style({
  flex: 1,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  color: 'var(--affine-text-primary-color)',
});

export const copyButton = style({
  padding: '4px 12px',
  border: '1px solid var(--affine-border-color)',
  borderRadius: 4,
  background: 'var(--affine-background-secondary-color)',
  fontSize: 12,
  color: 'var(--affine-text-primary-color)',
  cursor: 'pointer',
  selectors: {
    '&:hover': {
      background: 'var(--affine-hover-color)',
    },
  },
});

export const rotateButton = style({
  padding: '4px 12px',
  border: '1px solid var(--affine-border-color)',
  borderRadius: 4,
  background: 'var(--affine-background-secondary-color)',
  fontSize: 12,
  color: 'var(--affine-warning-color)',
  cursor: 'pointer',
});

export const rulesEditor = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
});

export const ruleRow = style({
  display: 'grid',
  gridTemplateColumns: '1fr 96px 1fr 1fr 32px',
  gap: 6,
  alignItems: 'center',
});

export const fieldInput = style({
  padding: '6px 10px',
  border: '1px solid var(--affine-border-color)',
  borderRadius: 4,
  background: 'var(--affine-background-primary-color)',
  fontSize: 12,
  color: 'var(--affine-text-primary-color)',
});

export const fieldSelect = style({
  padding: '6px 10px',
  border: '1px solid var(--affine-border-color)',
  borderRadius: 4,
  background: 'var(--affine-background-primary-color)',
  fontSize: 12,
  color: 'var(--affine-text-primary-color)',
});

export const ruleRemove = style({
  padding: 0,
  width: 28,
  height: 28,
  border: '1px solid var(--affine-border-color)',
  borderRadius: 4,
  background: 'transparent',
  color: 'var(--affine-error-color)',
  cursor: 'pointer',
});

export const addRuleButton = style({
  padding: '6px 12px',
  border: '1px dashed var(--affine-border-color)',
  borderRadius: 4,
  background: 'transparent',
  fontSize: 12,
  color: 'var(--affine-text-secondary-color)',
  cursor: 'pointer',
  alignSelf: 'flex-start',
});

export const createForm = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: 12,
  border: '1px dashed var(--affine-border-color)',
  borderRadius: 8,
});

export const createButton = style({
  padding: '6px 14px',
  border: '1px solid var(--affine-primary-color)',
  borderRadius: 4,
  background: 'var(--affine-primary-color)',
  color: 'white',
  fontSize: 12,
  cursor: 'pointer',
  alignSelf: 'flex-start',
});

export const empty = style({
  padding: 24,
  textAlign: 'center',
  color: 'var(--affine-text-secondary-color)',
  fontSize: 13,
});

export const inactiveBadge = style({
  padding: '2px 8px',
  borderRadius: 12,
  background: 'var(--affine-hover-color)',
  color: 'var(--affine-text-secondary-color)',
  fontSize: 11,
});
