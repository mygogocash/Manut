import { cssVar } from '@toeverything/theme';
import { cssVarV2 } from '@toeverything/theme/v2';
import { style } from '@vanilla-extract/css';

import { spaceY } from './index.css';

export const card = style({
  position: 'relative',
  padding: '8px 12px 12px 12px',
  borderRadius: 8,
  border: '1px solid ' + cssVarV2.layer.insideBorder.border,
  height: 150,
  display: 'flex',
  flexDirection: 'column',
  background: cssVarV2.layer.background.overlayPanel,
  cursor: 'pointer',
  color: 'unset',
  selectors: {
    '&:visited': {
      color: 'unset',
    },
    // When the card is gated behind a cloud workspace, mute the visual
    // weight so users understand it's unavailable without us hiding it.
    '&[data-cloud-only="true"]': {
      opacity: 0.5,
      cursor: 'not-allowed',
    },
    '&[data-cloud-only="true"]:hover': {
      opacity: 0.65,
    },
  },
});
export const cloudOnlyBadge = style({
  position: 'absolute',
  top: 8,
  right: 8,
  padding: '2px 6px',
  borderRadius: 4,
  fontSize: 10,
  lineHeight: '14px',
  fontWeight: 500,
  letterSpacing: 0.2,
  textTransform: 'uppercase',
  background: cssVarV2.layer.background.secondary,
  color: cssVarV2.text.secondary,
  border: '1px solid ' + cssVarV2.layer.insideBorder.border,
  pointerEvents: 'none',
});
export const cardHeader = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  height: 42,
  marginBottom: 4,
});
export const cardIcon = style({
  width: 32,
  height: 32,
  borderRadius: 4,
  background: cssVarV2.integrations.background.iconSolid,
  boxShadow: cssVar('buttonShadow'),
  border: `0.5px solid ${cssVarV2.layer.insideBorder.border}`,
  fontSize: 24,
  padding: 4,
  lineHeight: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: cssVarV2.icon.monotone,
});
export const cardContent = style([
  spaceY,
  {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
]);
export const cardTitle = style({
  fontSize: 14,
  fontWeight: 500,
  lineHeight: '22px',
  color: cssVarV2.text.primary,
});
export const cardStatus = style({
  fontSize: 12,
  lineHeight: '20px',
  fontWeight: 400,
  color: cssVarV2.text.secondary,
});
export const cardDesc = style([
  spaceY,
  {
    fontSize: 12,
    lineHeight: '20px',
    fontWeight: 400,
    color: cssVarV2.text.secondary,
  },
]);
export const cardFooter = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  justifyContent: 'space-between',
  selectors: {
    '&:not(:empty)': {
      marginTop: 8,
      height: 28,
    },
  },
});
