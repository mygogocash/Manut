import type { MnCostEventDto } from '@affine/core/modules/manut-control-plane/types';

import * as styles from './budget-dashboard.css';

/**
 * Drilldown: recent cost events for the selected scope. Caller passes
 * `events` already filtered + sorted (server-side) so this component
 * stays pure and stateless.
 */

interface BudgetDrilldownProps {
  events: MnCostEventDto[];
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function BudgetDrilldown({ events }: BudgetDrilldownProps) {
  if (events.length === 0) {
    return <div className={styles.empty}>No spend recorded yet.</div>;
  }

  return (
    <div className={styles.detailsList}>
      {events.map(event => (
        <div key={event.id} className={styles.detailRow}>
          <div>
            <strong>{event.provider}</strong> · {event.model}
            <div className={styles.detailMeta}>
              {new Date(event.occurredAt).toLocaleString()} ·{' '}
              {event.inputTokens.toLocaleString()} in /{' '}
              {event.outputTokens.toLocaleString()} out
            </div>
          </div>
          <div>{formatCents(event.costCents)}</div>
        </div>
      ))}
    </div>
  );
}
