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
  gap: 12,
});

export const title = style({
  fontSize: 22,
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

export const eventsList = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
});

export const eventRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '8px 12px',
  borderRadius: 8,
  border: `1px solid ${cssVar('borderColor')}`,
  background: cssVar('backgroundPrimaryColor'),
});

export const eventType = style({
  fontSize: 11,
  fontWeight: 600,
  color: cssVar('textSecondaryColor'),
  textTransform: 'uppercase',
  letterSpacing: 0.4,
  minWidth: 80,
});

export const eventMessage = style({
  fontSize: 13,
  color: cssVar('textPrimaryColor'),
  flex: 1,
  minWidth: 0,
});

export const eventTime = style({
  fontSize: 11,
  color: cssVar('textSecondaryColor'),
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

export const skeletonBlock = style({
  height: 64,
  borderRadius: 10,
  background: cssVar('backgroundTertiaryColor'),
  animation: `${skeletonShimmer} 1.4s ease-in-out infinite`,
  '@media': {
    '(prefers-reduced-motion: reduce)': {
      animation: 'none',
    },
  },
});
