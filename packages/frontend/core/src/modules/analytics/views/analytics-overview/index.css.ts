import { cssVar } from '@toeverything/theme';
import { keyframes, style } from '@vanilla-extract/css';

const skeletonShimmer = keyframes({
  '0%': { opacity: 0.6 },
  '50%': { opacity: 1 },
  '100%': { opacity: 0.6 },
});

export const root = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 20,
  padding: '24px 32px',
  width: '100%',
  maxWidth: 1080,
  margin: '0 auto',
  flex: 1,
  overflow: 'auto',
});

export const headerRow = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
});

export const title = style({
  fontSize: 24,
  fontWeight: 600,
  color: cssVar('textPrimaryColor'),
});

export const subtitle = style({
  fontSize: 13,
  color: cssVar('textSecondaryColor'),
});

export const sectionLabel = style({
  fontSize: 12,
  fontWeight: 600,
  color: cssVar('textSecondaryColor'),
  textTransform: 'uppercase',
  letterSpacing: 0.4,
  marginTop: 8,
});

export const kpiGrid = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
  gap: 12,
});

export const chartGrid = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
  gap: 12,
});

export const insightsList = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
});

export const empty = style({
  padding: '48px 16px',
  textAlign: 'center',
  color: cssVar('textSecondaryColor'),
  fontSize: 14,
  border: `1px dashed ${cssVar('borderColor')}`,
  borderRadius: 10,
});

// Skeleton mirrors the real loaded layout (section label + KPI grid +
// section label + chart grid) so swapping the skeleton for live content
// doesn't shift the page — keeps CLS low.
export const skeleton = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 20,
});

export const skeletonSectionLabel = style({
  height: 14,
  width: 120,
  borderRadius: 4,
  background: cssVar('hoverColor'),
  animation: `${skeletonShimmer} 1.4s ease-in-out infinite`,
  '@media': {
    '(prefers-reduced-motion: reduce)': {
      animation: 'none',
    },
  },
});

// Matches `kpiGrid` track sizing so KPI skeletons land where the real
// MetricCards will.
export const skeletonKpiGrid = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
  gap: 12,
});

// Matches `chartGrid` track sizing so chart skeletons land where the real
// TrendCharts will.
export const skeletonChartGrid = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
  gap: 12,
});

export const skeletonBlock = style({
  height: 96,
  borderRadius: 10,
  background: cssVar('hoverColor'),
  animation: `${skeletonShimmer} 1.4s ease-in-out infinite`,
  '@media': {
    '(prefers-reduced-motion: reduce)': {
      animation: 'none',
    },
  },
});

export const skeletonChartBlock = style({
  height: 220,
  borderRadius: 10,
  background: cssVar('hoverColor'),
  animation: `${skeletonShimmer} 1.4s ease-in-out infinite`,
  '@media': {
    '(prefers-reduced-motion: reduce)': {
      animation: 'none',
    },
  },
});

export const connectionRow = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '10px 14px',
  border: `1px solid ${cssVar('borderColor')}`,
  borderRadius: 8,
});

export const connectionLabel = style({
  fontSize: 13,
  fontWeight: 500,
});

export const connectionHandle = style({
  marginLeft: 8,
  color: cssVar('textSecondaryColor'),
  fontWeight: 400,
});

export const emptyHint = style({
  marginTop: 8,
  fontSize: 12,
  color: cssVar('textSecondaryColor'),
  opacity: 0.8,
});
