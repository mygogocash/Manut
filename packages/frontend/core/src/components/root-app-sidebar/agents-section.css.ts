import { cssVar } from '@toeverything/theme';
import { style } from '@vanilla-extract/css';

export const sectionRoot = style({
  display: 'flex',
  flexDirection: 'column',
  marginTop: 4,
  marginBottom: 4,
});

export const headerRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '4px 8px',
  fontSize: 12,
  fontWeight: 600,
  color: cssVar('textSecondaryColor'),
  textTransform: 'uppercase',
  letterSpacing: 0.4,
  userSelect: 'none',
});

export const headerLabel = style({
  flex: 1,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
});

export const betaBadge = style({
  display: 'inline-flex',
  alignItems: 'center',
  height: 16,
  padding: '0 6px',
  borderRadius: 4,
  background: cssVar('backgroundTertiaryColor'),
  color: cssVar('textPrimaryColor'),
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: 0.2,
  textTransform: 'none',
});

export const emptyHint = style({
  padding: '4px 12px',
  fontSize: 12,
  color: cssVar('textSecondaryColor'),
  fontStyle: 'italic',
});

export const modalContent = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  padding: '8px 0',
});

export const modalField = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
});

export const modalLabel = style({
  fontSize: 12,
  fontWeight: 500,
  color: cssVar('textSecondaryColor'),
});

export const modalInput = style({
  width: '100%',
});

export const modalTextarea = style({
  width: '100%',
  minHeight: 72,
  resize: 'vertical',
  padding: 8,
  borderRadius: 4,
  border: `1px solid ${cssVar('borderColor')}`,
  background: cssVar('backgroundPrimaryColor'),
  color: cssVar('textPrimaryColor'),
  fontFamily: 'inherit',
  fontSize: 14,
  lineHeight: 1.4,
  outline: 'none',
  selectors: {
    '&:focus': {
      borderColor: cssVar('primaryColor'),
    },
  },
});
