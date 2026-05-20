import { cssVarV2 } from '@toeverything/theme/v2';
import { style } from '@vanilla-extract/css';

// MANUT v1.13.x: scoped styles for the Figma integration card.
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

export const stateSubLabel = style({
  fontSize: 12,
  color: cssVarV2.text.secondary,
  marginTop: 2,
});

export const errorMessage = style({
  fontSize: 12,
  color: cssVarV2.status.error,
  padding: '8px 12px',
  borderRadius: 4,
  background: cssVarV2.layer.background.error,
});

export const comingSoonNote = style({
  fontSize: 12,
  color: cssVarV2.text.secondary,
  padding: '8px 12px',
  borderRadius: 4,
  background: cssVarV2.layer.background.secondary,
  border: `0.5px solid ${cssVarV2.layer.insideBorder.border}`,
});
