import type { MnBudgetRollupDto } from '@affine/core/modules/manut-control-plane/types';

import * as styles from './budget-dashboard.css';

/**
 * One project's spend row on the budget dashboard. Renders the
 * utilization bar with three colour states: blue (<80%), warning (80–99%),
 * danger (>=100%). The bar reads from the rolled-up `utilizationPct`
 * field so the server is the source of truth on percent math.
 */

interface BudgetProjectRowProps {
  rollup: MnBudgetRollupDto;
  onSelect?: (projectId: string | null) => void;
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function BudgetProjectRow({ rollup, onSelect }: BudgetProjectRowProps) {
  const pct = Math.max(0, Math.min(100, rollup.utilizationPct));
  // Warning state kicks in at the spec default (80%). Danger state at
  // 100%+ — same threshold the enforcer uses to actually block.
  const fillStyle =
    pct >= 100
      ? styles.utilizationFillDanger
      : pct >= 80
        ? styles.utilizationFillWarn
        : '';

  return (
    <tr
      onClick={() => onSelect?.(rollup.projectId)}
      style={{ cursor: onSelect ? 'pointer' : 'default' }}
    >
      <td className={styles.cell}>{rollup.projectId ?? '(unscoped)'}</td>
      <td className={styles.cellRight}>
        {rollup.capCents > 0 ? formatCents(rollup.capCents) : '—'}
      </td>
      <td className={styles.cellRight}>{formatCents(rollup.spentCents)}</td>
      <td className={styles.cell} style={{ width: 200 }}>
        <div className={styles.utilizationBar}>
          <div
            className={`${styles.utilizationFill} ${fillStyle}`.trim()}
            style={{ width: `${pct}%` }}
          />
        </div>
      </td>
      <td className={styles.cellRight}>{pct}%</td>
    </tr>
  );
}
