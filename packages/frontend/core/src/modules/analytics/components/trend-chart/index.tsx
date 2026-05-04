import * as styles from './index.css';

interface TrendChartProps {
  title: string;
  subtitle?: string;
  points: ReadonlyArray<{ ts: string; value: number }>;
}

const VIEW_W = 600;
const VIEW_H = 64;
const PAD = 4;

/**
 * Plain SVG sparkline. No charting library dependency. Replace with a richer
 * implementation (recharts/echarts) once the design surfaces full charts.
 */
export function TrendChart({ title, subtitle, points }: TrendChartProps) {
  const hasData = points.length > 1;
  const values = points.map(p => p.value);
  const min = hasData ? Math.min(...values) : 0;
  const max = hasData ? Math.max(...values) : 1;
  const range = max - min || 1;

  const xStep =
    points.length > 1 ? (VIEW_W - 2 * PAD) / (points.length - 1) : 0;

  const toY = (v: number) =>
    VIEW_H - PAD - ((v - min) / range) * (VIEW_H - 2 * PAD);

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${PAD + i * xStep} ${toY(p.value)}`)
    .join(' ');

  const areaPath = hasData
    ? `${linePath} L ${PAD + (points.length - 1) * xStep} ${VIEW_H - PAD} L ${PAD} ${VIEW_H - PAD} Z`
    : '';

  return (
    <div className={styles.chartCard}>
      <div className={styles.chartHeader}>
        <span className={styles.chartTitle}>{title}</span>
        {subtitle ? (
          <span className={styles.chartSubtitle}>{subtitle}</span>
        ) : null}
      </div>
      {hasData ? (
        <svg
          className={styles.sparkline}
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          preserveAspectRatio="none"
          aria-label={`${title} trend chart`}
        >
          <path className={styles.sparkArea} d={areaPath} />
          <path className={styles.sparkPath} d={linePath} />
        </svg>
      ) : (
        <div className={styles.empty}>No data yet</div>
      )}
    </div>
  );
}
