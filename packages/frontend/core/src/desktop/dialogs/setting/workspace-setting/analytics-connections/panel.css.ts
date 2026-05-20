import { cssVar } from '@toeverything/theme';
import { cssVarV2 } from '@toeverything/theme/v2';
import { style } from '@vanilla-extract/css';

// Manut token surface — falls back to existing AFFiNE tokens when
// the --manut-* CSS vars are not defined at runtime. This keeps the
// panel rendering correctly even before the Manut theme stylesheet
// lands on the page.

export const root = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
});

export const subtitle = style({
  fontSize: 13,
  color: cssVar('textSecondaryColor'),
});

export const list = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
  gap: 12,
});

export const card = style({
  // Manut design token with safe fallback to upstream AFFiNE radius.
  borderRadius: 'var(--manut-radius-card, 12px)',
  border: `1px solid ${cssVarV2.layer.insideBorder.border}`,
  background: cssVarV2.layer.background.overlayPanel,
  padding: 14,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  transition:
    'border-color var(--affine-anim-duration-base) var(--affine-anim-curve-default), box-shadow var(--affine-anim-duration-base) var(--affine-anim-curve-default)',
  selectors: {
    '&[data-connected="true"]': {
      borderColor: cssVarV2.status.success,
    },
    '&[data-busy="true"]': {
      opacity: 0.7,
      pointerEvents: 'none',
    },
  },
});

export const cardHeader = style({
  display: 'flex',
  alignItems: 'center',
  gap: 10,
});

export const cardLogo = style({
  width: 32,
  height: 32,
  borderRadius: 8,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: cssVarV2.layer.background.secondary,
  color: cssVarV2.text.primary,
  fontSize: 18,
  flexShrink: 0,
});

export const cardTitle = style({
  fontSize: 14,
  fontWeight: 600,
  color: cssVarV2.text.primary,
  margin: 0,
});

export const cardSubtitle = style({
  fontSize: 11,
  color: cssVarV2.text.secondary,
});

export const cardBody = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  flex: 1,
});

export const cardDesc = style({
  fontSize: 12,
  color: cssVarV2.text.secondary,
  lineHeight: 1.5,
});

export const cardFooter = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  marginTop: 4,
});

export const badge = style({
  display: 'inline-flex',
  alignItems: 'center',
  padding: '2px 8px',
  borderRadius: 999,
  background: cssVarV2.layer.background.secondary,
  color: cssVarV2.text.secondary,
  fontSize: 11,
  fontWeight: 500,
  selectors: {
    '&[data-tone="connected"]': {
      background: 'color-mix(in oklab, currentColor 12%, transparent)',
      color: cssVarV2.status.success,
    },
    '&[data-tone="warning"]': {
      background: 'color-mix(in oklab, currentColor 12%, transparent)',
      color: cssVarV2.icon.activated,
    },
  },
});

export const button = style({
  display: 'inline-flex',
  alignItems: 'center',
  height: 28,
  padding: '0 12px',
  borderRadius: 6,
  border: `1px solid ${cssVarV2.layer.insideBorder.border}`,
  background: cssVarV2.layer.background.primary,
  color: cssVarV2.text.primary,
  fontSize: 12,
  fontWeight: 500,
  cursor: 'pointer',
  transition:
    'background-color var(--affine-anim-duration-base) var(--affine-anim-curve-default), border-color var(--affine-anim-duration-base) var(--affine-anim-curve-default)',
  selectors: {
    '&:hover:not([disabled])': {
      background: cssVarV2.layer.background.secondary,
    },
    '&[disabled]': {
      opacity: 0.5,
      cursor: 'not-allowed',
    },
  },
});

export const buttonPrimary = style({
  // Manut accent — falls back to AFFiNE primary when the --manut-*
  // var isn't set. We use color-mix on hover for a slightly darker
  // tint without needing a second token.
  background: 'var(--manut-accent-violet, var(--affine-primary-color))',
  color: '#fff',
  borderColor: 'transparent',
  selectors: {
    '&:hover:not([disabled])': {
      filter: 'brightness(1.08)',
      background: 'var(--manut-accent-violet, var(--affine-primary-color))',
    },
  },
});

export const inlineForm = style({
  marginTop: 4,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: 12,
  borderRadius: 8,
  background: cssVarV2.layer.background.secondary,
  border: `1px dashed ${cssVarV2.layer.insideBorder.border}`,
});

export const inlineLabel = style({
  fontSize: 12,
  fontWeight: 500,
  color: cssVarV2.text.secondary,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
});

export const inlineInput = style({
  fontFamily: 'inherit',
  fontSize: 12,
  padding: '6px 8px',
  borderRadius: 6,
  border: `1px solid ${cssVarV2.layer.insideBorder.border}`,
  background: cssVarV2.layer.background.primary,
  color: cssVarV2.text.primary,
  width: '100%',
  selectors: {
    '&:focus-visible': {
      outline: `2px solid var(--manut-accent-violet, ${cssVar('primaryColor')})`,
      outlineOffset: 1,
    },
  },
});

export const inlineActions = style({
  display: 'flex',
  gap: 8,
  alignItems: 'center',
  flexWrap: 'wrap',
});

export const errorBanner = style({
  padding: '8px 10px',
  borderRadius: 6,
  background: 'color-mix(in oklab, currentColor 14%, transparent)',
  color: cssVarV2.button.error,
  fontSize: 12,
  lineHeight: 1.5,
  wordBreak: 'break-word',
});

export const successText = style({
  fontSize: 11,
  color: cssVarV2.status.success,
});

export const helpText = style({
  fontSize: 11,
  color: cssVarV2.text.secondary,
  marginTop: 6,
});
