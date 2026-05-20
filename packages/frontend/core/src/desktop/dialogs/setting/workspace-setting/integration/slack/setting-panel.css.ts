import { cssVarV2 } from '@toeverything/theme/v2';
import { style } from '@vanilla-extract/css';

// MANUT v1.13.x: scoped styles for the Slack integration card.
// Vanilla-extract `style()` MUST live in `.css.ts` (CLAUDE.md §6 — a
// `.css.ts` call from a `.tsx` file silently breaks React mount).
export const root = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  padding: '8px 0',
});

export const stateRow = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 0',
});

export const stateLabel = style({
  fontSize: 13,
  color: cssVarV2.text.primary,
});

export const errorMessage = style({
  fontSize: 12,
  color: cssVarV2.status.error,
  padding: '8px 12px',
  borderRadius: 4,
  background: cssVarV2.layer.background.error,
});

// "Live import is rolling out soon" footer — same shape as the
// GitHub/Google scaffolds. Set apart from the connected-state label
// so users understand the *connection* works even though the
// *import UX* hasn't shipped.
export const comingSoonNote = style({
  fontSize: 12,
  color: cssVarV2.text.secondary,
  padding: '8px 12px',
  borderRadius: 4,
  background: cssVarV2.layer.background.secondary,
  border: `0.5px solid ${cssVarV2.layer.insideBorder.border}`,
});

// MANUT v1.13.x: dedicated empty state for the "OAuth client not
// configured" admin task. Mirrors the GitHub panel's
// notConfiguredPlate so every connector card carries the same UX
// when the server is missing OAuth credentials — red banner is the
// wrong signal (users assume retry will help).
export const notConfiguredPlate = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 8,
  padding: '24px 20px',
  borderRadius: 'var(--manut-radius-card, 8px)',
  border: `1px dashed var(--manut-accent-violet-border, #7b61ff)`,
  background: 'var(--manut-accent-violet-bg, rgba(123, 97, 255, 0.06))',
  color: cssVarV2.text.primary,
  textAlign: 'center',
});

export const notConfiguredIcon = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 32,
  height: 32,
  borderRadius: 'var(--manut-radius-card, 8px)',
  color: 'var(--manut-accent-violet-border, #7b61ff)',
});

export const notConfiguredTitle = style({
  fontSize: 14,
  lineHeight: '20px',
  fontWeight: 500,
  color: cssVarV2.text.primary,
});

export const notConfiguredCopy = style({
  fontSize: 12,
  lineHeight: '18px',
  color: cssVarV2.text.secondary,
  maxWidth: 380,
});

export const notConfiguredEnv = style({
  display: 'inline-block',
  padding: '1px 6px',
  borderRadius: 4,
  background: cssVarV2.layer.background.secondary,
  border: `0.5px solid ${cssVarV2.layer.insideBorder.border}`,
  fontFamily:
    'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", monospace',
  fontSize: 11,
  color: cssVarV2.text.primary,
});
