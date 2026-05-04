import { cssVarV2 } from '@toeverything/theme/v2';
import { style } from '@vanilla-extract/css';

/**
 * Shared layout for the Gmail import + Drive picker dialogs.
 *
 * Both dialogs follow the same pattern: search-box on top, scrolling
 * list below, single status / empty / loading state inside the list
 * area. Co-locating their styles keeps them visually consistent and
 * avoids two near-identical CSS files.
 */

export const dialog = style({
  width: 'min(640px, 92vw)',
  maxHeight: 'min(720px, 92vh)',
  display: 'flex',
  flexDirection: 'column',
});

export const searchRow = style({
  padding: '0 0 12px',
});

export const listScroll = style({
  flex: 1,
  minHeight: 320,
  maxHeight: 520,
  overflowY: 'auto',
  marginRight: -4,
  paddingRight: 4,
});

export const list = style({
  listStyle: 'none',
  padding: 0,
  margin: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
});

export const listItem = style({
  display: 'flex',
  alignItems: 'flex-start',
  gap: 12,
  padding: '12px',
  borderRadius: 6,
  border: `0.5px solid ${cssVarV2.layer.insideBorder.border}`,
  background: cssVarV2.layer.background.primary,
});

export const itemBody = style({
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
});

export const itemSubject = style({
  fontSize: 14,
  fontWeight: 500,
  color: cssVarV2.text.primary,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
});

export const itemMeta = style({
  fontSize: 12,
  color: cssVarV2.text.secondary,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
});

export const itemSnippet = style({
  fontSize: 12,
  color: cssVarV2.text.secondary,
  marginTop: 4,
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
});

export const itemActions = style({
  display: 'flex',
  flexDirection: 'row',
  gap: 8,
  alignItems: 'center',
  flexShrink: 0,
});

export const skeletonGroup = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
});

export const emptyState = style({
  padding: '48px 16px',
  textAlign: 'center',
  fontSize: 13,
  color: cssVarV2.text.secondary,
});

export const errorMessage = style({
  padding: '16px',
  fontSize: 13,
  color: cssVarV2.status.error,
  background: cssVarV2.layer.background.error,
  borderRadius: 6,
});

export const driveTitleRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  minWidth: 0,
});

export const driveIcon = style({
  flexShrink: 0,
});
