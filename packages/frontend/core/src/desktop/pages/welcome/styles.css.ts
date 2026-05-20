import { manutColor, manutRadius, manutSpace } from '@affine/component/theme';
import { style } from '@vanilla-extract/css';

/**
 * Welcome / first-workspace page styles.
 *
 * Wave 2 B5 — first-time workspace creation. New users land here after
 * sign-up and are asked to name their workspace before being routed
 * into /workspace/{id}/all.
 *
 * Wave 2 B6 — extends the same page into a 5-step wizard
 * (workspace-name + 4 onboarding questions). Step containers reuse
 * the same card / form primitives so the visual rhythm holds across
 * the whole flow.
 *
 * Visual language follows the Manut warm-neutral palette with a
 * violet accent on the primary CTA. Lives under `.css.ts` and only
 * imports from `@affine/component/theme` (a leaf sub-path) — the
 * package root would pull in DOM-typed siblings and crash
 * vanilla-extract's Node VM evaluation. See CLAUDE.md §6
 * "vanilla-extract evaluates .css.ts files in a Node VM" for the
 * scar this guards against.
 */

export const root = style({
  minHeight: '100vh',
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: manutSpace(6),
  // Warm neutral surface — picks up the body background, no extra fill.
  color: 'var(--affine-text-primary-color)',
});

export const card = style({
  width: '100%',
  maxWidth: '480px',
  display: 'flex',
  flexDirection: 'column',
  gap: manutSpace(5),
  padding: manutSpace(7),
  backgroundColor: 'var(--affine-background-overlay-panel-color)',
  border: '1px solid var(--affine-border-color)',
  borderRadius: manutRadius.card,
  boxShadow: 'var(--affine-shadow-2)',
  position: 'relative',
});

export const topBar = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: manutSpace(3),
});

export const dots = style({
  display: 'flex',
  alignItems: 'center',
  gap: manutSpace(2),
});

export const dot = style({
  width: '8px',
  height: '8px',
  borderRadius: '999px',
  backgroundColor: 'var(--affine-divider-color)',
  transition: 'background-color 150ms ease, transform 150ms ease',
});

export const dotActive = style({
  backgroundColor: manutColor.violet.fg,
  transform: 'scale(1.15)',
});

export const dotCompleted = style({
  backgroundColor: manutColor.violet.fg,
  opacity: 0.55,
});

export const skipButton = style({
  // Hugs the right edge — paired with the dot row in the top bar.
  background: 'transparent',
  border: 'none',
  color: 'var(--affine-text-secondary-color)',
  fontSize: '13px',
  fontWeight: 500,
  cursor: 'pointer',
  padding: `${manutSpace(1)} ${manutSpace(2)}`,
  borderRadius: manutRadius.input,
  selectors: {
    '&:hover': {
      color: 'var(--affine-text-primary-color)',
      backgroundColor: 'var(--affine-hover-color)',
    },
    '&:disabled': {
      opacity: 0.4,
      cursor: 'not-allowed',
    },
  },
});

export const greeting = style({
  display: 'flex',
  flexDirection: 'column',
  gap: manutSpace(2),
});

export const headline = style({
  fontSize: '28px',
  lineHeight: 1.2,
  fontWeight: 700,
  margin: 0,
  letterSpacing: '-0.01em',
});

export const subCopy = style({
  fontSize: '14px',
  lineHeight: 1.5,
  color: 'var(--affine-text-secondary-color)',
  margin: 0,
});

export const form = style({
  display: 'flex',
  flexDirection: 'column',
  gap: manutSpace(4),
});

export const label = style({
  display: 'flex',
  flexDirection: 'column',
  gap: manutSpace(2),
  fontSize: '13px',
  fontWeight: 500,
  color: 'var(--affine-text-secondary-color)',
});

export const errorText = style({
  fontSize: '12px',
  lineHeight: 1.4,
  color: 'var(--affine-error-color)',
  margin: 0,
});

export const submitButton = style({
  alignSelf: 'stretch',
  // Violet accent on the primary CTA to match the Manut visual system.
  backgroundColor: manutColor.violet.fg,
  borderColor: manutColor.violet.fg,
  color: '#ffffff',
  selectors: {
    '&:hover:not([disabled])': {
      // Subtle darken on hover — keep the violet accent dominant.
      filter: 'brightness(0.95)',
    },
  },
});

export const navRow = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: manutSpace(3),
  marginTop: manutSpace(2),
});

export const backButton = style({
  background: 'transparent',
  border: '1px solid var(--affine-border-color)',
  color: 'var(--affine-text-primary-color)',
  fontSize: '14px',
  fontWeight: 500,
  cursor: 'pointer',
  padding: `${manutSpace(2)} ${manutSpace(4)}`,
  borderRadius: manutRadius.input,
  selectors: {
    '&:hover:not([disabled])': {
      backgroundColor: 'var(--affine-hover-color)',
    },
    '&:disabled': {
      opacity: 0.4,
      cursor: 'not-allowed',
    },
  },
});

/**
 * Categorical option button — used for the context, team, and app
 * selection grids. Visually behaves like a chip with a check mark
 * when active.
 */
export const optionGrid = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 1fr)',
  gap: manutSpace(3),
});

export const optionGridSingle = style({
  display: 'flex',
  flexDirection: 'column',
  gap: manutSpace(3),
});

export const option = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-start',
  gap: manutSpace(3),
  textAlign: 'left',
  background: 'var(--affine-white)',
  border: '1px solid var(--affine-border-color)',
  borderRadius: manutRadius.input,
  padding: `${manutSpace(3)} ${manutSpace(4)}`,
  fontSize: '14px',
  fontWeight: 500,
  color: 'var(--affine-text-primary-color)',
  cursor: 'pointer',
  transition: 'background-color 120ms ease, border-color 120ms ease',
  selectors: {
    '&:hover:not([disabled])': {
      backgroundColor: 'var(--affine-hover-color)',
      borderColor: manutColor.violet.border,
    },
    '&:disabled': {
      opacity: 0.5,
      cursor: 'not-allowed',
    },
  },
});

export const optionSelected = style({
  borderColor: manutColor.violet.fg,
  backgroundColor: manutColor.violet.bg,
  selectors: {
    '&:hover:not([disabled])': {
      borderColor: manutColor.violet.fg,
      backgroundColor: manutColor.violet.bg,
    },
  },
});

export const optionLabel = style({
  display: 'flex',
  flexDirection: 'column',
  gap: manutSpace(1),
});

export const optionTitle = style({
  fontSize: '14px',
  fontWeight: 600,
  color: 'var(--affine-text-primary-color)',
});

export const optionDescription = style({
  fontSize: '12px',
  fontWeight: 400,
  color: 'var(--affine-text-secondary-color)',
});

export const checkbox = style({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '20px',
  height: '20px',
  borderRadius: '6px',
  border: '1px solid var(--affine-border-color)',
  backgroundColor: 'var(--affine-white)',
  fontSize: '14px',
  color: manutColor.violet.fg,
  flexShrink: 0,
});

export const checkboxChecked = style({
  borderColor: manutColor.violet.fg,
  backgroundColor: manutColor.violet.fg,
  color: '#ffffff',
});
