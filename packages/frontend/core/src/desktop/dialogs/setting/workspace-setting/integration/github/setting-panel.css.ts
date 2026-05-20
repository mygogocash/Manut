import { cssVarV2 } from '@toeverything/theme/v2';
import { style } from '@vanilla-extract/css';

// MANUT v1.13.0: scoped styles for the GitHub integration card.
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
// Google scaffold's coming-soon notice. Set apart from the
// connected-state label so users understand the *connection* works
// even though the *import UX* hasn't shipped.
export const comingSoonNote = style({
  fontSize: 12,
  color: cssVarV2.text.secondary,
  padding: '8px 12px',
  borderRadius: 4,
  background: cssVarV2.layer.background.secondary,
  border: `0.5px solid ${cssVarV2.layer.insideBorder.border}`,
});

// Dedicated empty state when the server is missing
// GITHUB_OAUTH_CLIENT_ID / _SECRET. Mirrors the Google scaffold
// pattern (CLAUDE.md §6 v1.10.2 — "configure OAuth client" message)
// but rendered as a violet brand plate using --manut-radius-card so
// the user reads "this is an admin task" instead of "the app
// crashed". Same dashed-border + centred-text shape as
// account-setting/memory-panel.css.ts emptyState.
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
