import { cssVar } from '@toeverything/theme';
import { style } from '@vanilla-extract/css';

export const chartCard = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  padding: '16px 18px',
  borderRadius: 10,
  border: `1px solid ${cssVar('borderColor')}`,
  background: cssVar('backgroundPrimaryColor'),
});

export const chartHeader = style({
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
});

export const chartTitle = style({
  fontSize: 13,
  fontWeight: 600,
  color: cssVar('textPrimaryColor'),
});

export const chartSubtitle = style({
  fontSize: 11,
  color: cssVar('textSecondaryColor'),
});

export const sparkline = style({
  width: '100%',
  height: 64,
  display: 'block',
});

export const sparkPath = style({
  fill: 'none',
  stroke: cssVar('primaryColor'),
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
});

export const sparkArea = style({
  fill: cssVar('primaryColor'),
  fillOpacity: 0.1,
  stroke: 'none',
});

export const empty = style({
  fontSize: 12,
  color: cssVar('textSecondaryColor'),
  padding: '20px 0',
  textAlign: 'center',
});
