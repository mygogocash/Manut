import {
  bodyEmphasized,
  footnoteRegular,
} from '@toeverything/theme/typography';
import { cssVarV2 } from '@toeverything/theme/v2';
import { style } from '@vanilla-extract/css';

export const card = style({
  // Manut M2 E2.7 — `position: 'relative'` so the absolutely-positioned
  // hover preview overlay (see `hoverPreview` below) anchors to the card
  // rather than the nearest positioned ancestor (which on mobile is the
  // entire viewport).
  position: 'relative',
  padding: 16,
  borderRadius: 'var(--manut-radius-card)',
  border: `0.5px solid ${cssVarV2('layer/insideBorder/border')}`,
  boxShadow: '0px 2px 3px rgba(0,0,0,0.05)',
  background: cssVarV2('layer/background/mobile/secondary'),

  display: 'flex',
  flexDirection: 'column',
  gap: 8,

  transition: 'transform 120ms var(--manut-anim-curve-overshoot)',

  color: 'unset',
  ':visited': { color: 'unset' },
  ':hover': { color: 'unset' },
  ':active': { color: 'unset', transform: 'scale(0.985)' },
});
export const head = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
});
export const title = style([
  bodyEmphasized,
  {
    width: 0,
    flex: 1,
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
    overflow: 'hidden',
  },
]);
export const untitled = style({
  opacity: 0.4,
});
export const content = style([
  footnoteRegular,
  {
    overflow: 'hidden',
  },
]);

export const contentEmpty = style({
  opacity: 0.3,
});

// Manut M2 E2.7 — hover preview overlay. Floats over the bottom edge of
// the card to surface a 3-line snippet + title without navigating. The
// overlay is decorative — every byte of information it shows is also
// rendered in the card body — so we hide it entirely under reduced-motion
// (the React layer gates render; this is the visual contract).
//
// The card itself uses `position: 'static'` by default; the overlay
// pins to the card via `position: 'absolute'` and relies on the parent
// being a positioned ancestor. Wrap the card in `position: relative`
// at the consumer level if you need a different anchor; for the mobile
// list the inline-flex layout already creates the containing block.
export const hoverPreview = style({
  position: 'absolute',
  left: 0,
  right: 0,
  top: '100%',
  marginTop: 8,
  padding: 12,
  borderRadius: 'var(--manut-radius-card)',
  background: cssVarV2('layer/background/primary'),
  border: `0.5px solid ${cssVarV2('layer/insideBorder/border')}`,
  boxShadow: '0 12px 32px rgba(0, 0, 0, 0.18)',
  zIndex: 4,
  pointerEvents: 'none',
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
});

export const hoverPreviewTitle = style([
  bodyEmphasized,
  {
    fontSize: 13,
    fontWeight: 600,
    color: cssVarV2('text/primary'),
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
]);

export const hoverPreviewSnippet = style([
  footnoteRegular,
  {
    fontSize: 12,
    color: cssVarV2('text/secondary'),
    display: '-webkit-box',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: 3,
    overflow: 'hidden',
  },
]);
