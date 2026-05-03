import { cssVar } from '@toeverything/theme';
import { style } from '@vanilla-extract/css';

export const body = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  padding: '24px 32px',
  width: '100%',
  maxWidth: 960,
  margin: '0 auto',
  flex: 1,
  overflow: 'auto',
});

export const headerRow = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 8,
});

export const title = style({
  fontSize: 24,
  fontWeight: 600,
  color: cssVar('textPrimaryColor'),
  display: 'flex',
  alignItems: 'center',
  gap: 8,
});

export const betaBadge = style({
  display: 'inline-flex',
  alignItems: 'center',
  height: 18,
  padding: '0 8px',
  borderRadius: 4,
  background: cssVar('backgroundTertiaryColor'),
  color: cssVar('textPrimaryColor'),
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: 0.2,
});

export const subtitle = style({
  fontSize: 13,
  color: cssVar('textSecondaryColor'),
  marginBottom: 16,
});

export const list = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
});

export const listItem = style({
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '12px 16px',
  borderRadius: 8,
  border: `1px solid ${cssVar('borderColor')}`,
  background: cssVar('backgroundPrimaryColor'),
  cursor: 'pointer',
  textDecoration: 'none',
  color: 'inherit',
  transition: 'background 0.15s',
  selectors: {
    '&:hover': {
      background: cssVar('backgroundTertiaryColor'),
    },
  },
});

export const itemIcon = style({
  fontSize: 20,
  color: cssVar('iconColor'),
  flexShrink: 0,
});

export const itemBody = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  flex: 1,
  minWidth: 0,
});

export const itemName = style({
  fontSize: 14,
  fontWeight: 500,
  color: cssVar('textPrimaryColor'),
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
});

export const itemDescription = style({
  fontSize: 12,
  color: cssVar('textSecondaryColor'),
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
});

export const empty = style({
  padding: '64px 16px',
  textAlign: 'center',
  color: cssVar('textSecondaryColor'),
  fontSize: 14,
});
