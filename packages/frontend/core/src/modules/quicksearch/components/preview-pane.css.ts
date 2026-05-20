import { cssVar } from '@toeverything/theme';
import { style } from '@vanilla-extract/css';

// Right-side preview pane styling. Manut tokens consumed as raw CSS vars
// (CLAUDE.md §6 — never import from `@affine/component` package root in
// `.css.ts` files).

export const previewPane = style({
  flex: 1,
  minWidth: 0,
  maxWidth: 360,
  padding: '16px',
  borderLeft: `1px solid ${cssVar('dividerColor')}`,
  background: cssVar('backgroundPrimaryColor'),
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  overflow: 'auto',
  borderTopRightRadius: 'var(--manut-radius-card, 12px)',
  borderBottomRightRadius: 'var(--manut-radius-card, 12px)',
});

export const previewEmpty = style({
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: cssVar('fontXs'),
  color: cssVar('textSecondaryColor'),
  textAlign: 'center',
  padding: '24px 12px',
});

export const previewTitle = style({
  fontSize: cssVar('fontH5'),
  fontWeight: 600,
  lineHeight: 1.3,
  color: cssVar('textPrimaryColor'),
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
});

export const previewTitleIcon = style({
  fontSize: 18,
  width: '1em',
  height: '1em',
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: cssVar('iconSecondary'),
});

export const previewMeta = style({
  fontSize: cssVar('fontXs'),
  color: cssVar('textSecondaryColor'),
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
});

export const previewSnippet = style({
  fontSize: cssVar('fontSm'),
  lineHeight: 1.6,
  color: cssVar('textPrimaryColor'),
  whiteSpace: 'pre-wrap',
  overflowWrap: 'anywhere',
  marginTop: 4,
});

export const previewHints = style({
  marginTop: 'auto',
  paddingTop: 12,
  borderTop: `1px solid ${cssVar('dividerColor')}`,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  fontSize: cssVar('fontXs'),
  color: cssVar('textSecondaryColor'),
});

export const previewHintRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: 6,
});

export const previewHintKey = style({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0 4px',
  minWidth: 18,
  height: 18,
  borderRadius: 4,
  background: cssVar('backgroundTertiaryColor'),
  fontSize: 10,
  fontFamily: 'inherit',
});

// Split layout — list on the left, preview on the right.
export const splitLayout = style({
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'stretch',
  flex: 1,
  minHeight: 0,
});

export const splitListColumn = style({
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
});
