import * as styles from './index.css';

interface MetricCardProps {
  label: string;
  value: string | number;
  delta?: number;
  deltaFormat?: 'count' | 'percent';
}

const formatValue = (value: string | number): string => {
  if (typeof value === 'string') return value;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toString();
};

const formatDelta = (delta: number, format: 'count' | 'percent'): string => {
  const sign = delta >= 0 ? '+' : '';
  if (format === 'percent') {
    return `${sign}${(delta * 100).toFixed(1)}%`;
  }
  return `${sign}${formatValue(delta)}`;
};

export function MetricCard({
  label,
  value,
  delta,
  deltaFormat = 'count',
}: MetricCardProps) {
  const deltaClass =
    delta === undefined
      ? styles.deltaNeutral
      : delta > 0
        ? styles.deltaPositive
        : delta < 0
          ? styles.deltaNegative
          : styles.deltaNeutral;

  return (
    <div className={styles.card}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{formatValue(value)}</span>
      <div className={styles.deltaRow}>
        <span className={deltaClass}>
          {delta === undefined ? '—' : formatDelta(delta, deltaFormat)}
        </span>
        <span className={styles.deltaNeutral}>vs last 7d</span>
      </div>
    </div>
  );
}
